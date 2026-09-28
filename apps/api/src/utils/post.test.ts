import { describe, expect, it } from 'vitest'

import { Types } from 'mongoose'

import { decodePostCursor } from '#utils/cursor'
import type { PostCardSource } from '#utils/post'
import {
  POST_CARD_FIELDS,
  postCursorFor,
  toPostCardDto,
  toPostDetailDto,
  toPostDto,
} from '#utils/post'

/** The document `toPostDto` accepts, read off the mapper's own signature so the
 * test never has to import the Post model or reach a connection. */
type PostDocumentArg = Parameters<typeof toPostDto>[0]

const POST_ID = new Types.ObjectId('65f1c0de5a1e2b3c4d5e6f10')
const AUTHOR_ID = new Types.ObjectId('65f1c0de5a1e2b3c4d5e6f01')
const TAG_IDS = [
  new Types.ObjectId('65f1c0de5a1e2b3c4d5e6f02'),
  new Types.ObjectId('65f1c0de5a1e2b3c4d5e6f03'),
]

const MARKDOWN = '# REST API\n\nBuild it with Express.'
const CREATED_AT = new Date('2026-01-02T00:00:00.000Z')
const PUBLISHED_AT = new Date('2026-01-03T00:00:00.000Z')
const UPDATED_AT = new Date('2026-01-09T00:00:00.000Z')

/**
 * A hydrated post carrying the fields the mapper reads. `get` backs the
 * timestamps the way Mongoose serves them, and `__v` stands in for the version
 * key a document holds but the wire contract must not.
 */
function postDocument(
  publishedAt: Date | null = PUBLISHED_AT,
): PostDocumentArg {
  const fields = {
    _id: POST_ID,
    title: 'Building a REST API',
    slug: 'building-a-rest-api',
    content: MARKDOWN,
    excerpt: 'Build an API with Express.',
    coverImage: 'https://cdn.example.com/cover.png',
    status: 'published',
    publishedAt,
    author: AUTHOR_ID,
    tags: TAG_IDS,
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    __v: 7,
  }

  return {
    ...fields,
    get: (path: string) => fields[path as keyof typeof fields],
  } as unknown as PostDocumentArg
}

/** A lean post with populated relations, as the public read queries return it. */
function cardSource(publishedAt: Date | null = PUBLISHED_AT): PostCardSource {
  return {
    _id: POST_ID,
    title: 'Building a REST API',
    slug: 'building-a-rest-api',
    excerpt: 'Build an API with Express.',
    coverImage: 'https://cdn.example.com/cover.png',
    status: 'published',
    publishedAt,
    author: {
      _id: AUTHOR_ID,
      name: 'Harsh Thakur',
      avatarUrl: 'https://cdn.example.com/avatar.png',
    },
    tags: [
      { _id: TAG_IDS[0], name: 'Express', slug: 'express' },
      { _id: TAG_IDS[1], name: 'REST', slug: 'rest' },
    ],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  }
}

/** Decodes a cursor the mapper produced, keeping a null cursor distinguishable. */
function decode(cursor: string | null) {
  return cursor === null ? null : decodePostCursor(cursor)
}

describe('toPostDto', () => {
  it('maps the document onto the wire contract', () => {
    expect(toPostDto(postDocument())).toEqual({
      id: POST_ID.toString(),
      title: 'Building a REST API',
      slug: 'building-a-rest-api',
      content: MARKDOWN,
      excerpt: 'Build an API with Express.',
      coverImage: 'https://cdn.example.com/cover.png',
      status: 'published',
      author: AUTHOR_ID.toString(),
      tags: TAG_IDS.map((tag) => tag.toString()),
      publishedAt: PUBLISHED_AT.toISOString(),
      createdAt: CREATED_AT.toISOString(),
      updatedAt: UPDATED_AT.toISOString(),
    })
  })

  it('names the document id `id` and leaves the version key off', () => {
    const dto = toPostDto(postDocument())

    expect(dto.id).toBe(POST_ID.toString())
    expect(dto).not.toHaveProperty('_id')
    expect(dto).not.toHaveProperty('__v')
  })

  it('reports a draft as unpublished rather than as an invalid date', () => {
    expect(toPostDto(postDocument(null)).publishedAt).toBeNull()
  })
})

describe('toPostCardDto', () => {
  it('embeds the author and the tag summaries', () => {
    const dto = toPostCardDto(cardSource())

    expect(dto.author).toEqual({
      id: AUTHOR_ID.toString(),
      name: 'Harsh Thakur',
      avatarUrl: 'https://cdn.example.com/avatar.png',
    })
    expect(dto.tags).toEqual([
      { id: TAG_IDS[0].toString(), name: 'Express', slug: 'express' },
      { id: TAG_IDS[1].toString(), name: 'REST', slug: 'rest' },
    ])
  })

  it('never carries the stored Markdown body', () => {
    expect(toPostCardDto(cardSource())).not.toHaveProperty('content')
  })

  it('reports a draft as unpublished rather than as an invalid date', () => {
    expect(toPostCardDto(cardSource(null)).publishedAt).toBeNull()
  })
})

describe('toPostDetailDto', () => {
  it('is the card plus the raw Markdown body', () => {
    const source = cardSource()
    const dto = toPostDetailDto({ ...source, content: MARKDOWN })

    expect(dto).toEqual({ ...toPostCardDto(source), content: MARKDOWN })
  })
})

describe('postCursorFor', () => {
  it('anchors the cursor on the field the list is ordered by', () => {
    expect(decode(postCursorFor(cardSource(), 'publishedAt'))).toEqual({
      at: PUBLISHED_AT,
      id: POST_ID,
    })
  })

  it('reads creation date for the list that is ordered by it', () => {
    expect(decode(postCursorFor(cardSource(null), 'createdAt'))).toEqual({
      at: CREATED_AT,
      id: POST_ID,
    })
  })

  // A draft has no `publishedAt`, so there is no position to hand back.
  it('has no cursor for a post missing the field it is ordered by', () => {
    expect(postCursorFor(cardSource(null), 'publishedAt')).toBeNull()
  })
})

describe('POST_CARD_FIELDS', () => {
  it('projects the card fields and never the stored body', () => {
    const fields = POST_CARD_FIELDS.split(/\s+/)

    expect(fields).toContain('publishedAt')
    expect(fields).toContain('author')
    expect(fields).not.toContain('content')
  })
})
