import { describe, expect, it } from 'vitest'

import { createPostBodySchema, postPageQuerySchema } from '#schemas/post'
import { listPostsQuerySchema, updatePostBodySchema } from '#schemas/post'

const VALID_POST = {
  title: 'Building a REST API with Express',
  content: '# Heading\n\n    indented code block\n',
  tags: ['node', 'express'],
}

describe('createPostBodySchema', () => {
  it('defaults a new post to a draft', () => {
    expect(createPostBodySchema.parse(VALID_POST).status).toBe('draft')
  })

  it('keeps a requested published status', () => {
    expect(
      createPostBodySchema.parse({ ...VALID_POST, status: 'published' }).status,
    ).toBe('published')
  })

  it('rejects an unknown status', () => {
    expect(
      createPostBodySchema.safeParse({ ...VALID_POST, status: 'archived' })
        .success,
    ).toBe(false)
  })

  it('trims the title', () => {
    expect(
      createPostBodySchema.parse({ ...VALID_POST, title: '  Express  ' }).title,
    ).toBe('Express')
  })

  it('rejects a title longer than 200 characters', () => {
    expect(
      createPostBodySchema.safeParse({ ...VALID_POST, title: 'a'.repeat(201) })
        .success,
    ).toBe(false)
  })

  // An unreachable URL is the failure this prevents.
  it('rejects a title with no ASCII form to slugify', () => {
    expect(
      createPostBodySchema.safeParse({ ...VALID_POST, title: '日本語' })
        .success,
    ).toBe(false)
  })

  // Not trimmed: leading indentation is meaningful in Markdown.
  it('stores the content verbatim, whitespace included', () => {
    const content = '    indented code block\n\ntrailing spaces   '

    expect(createPostBodySchema.parse({ ...VALID_POST, content }).content).toBe(
      content,
    )
  })

  it('rejects a whitespace-only body', () => {
    const parsed = createPostBodySchema.safeParse({
      ...VALID_POST,
      content: '  \n\t ',
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe('Content is required')
  })

  it('requires at least one tag', () => {
    expect(
      createPostBodySchema.safeParse({ ...VALID_POST, tags: [] }).success,
    ).toBe(false)
  })

  it('accepts ten tags and rejects eleven', () => {
    const tags = Array.from({ length: 10 }, (_, index) => `tag-${index}`)

    expect(
      createPostBodySchema.safeParse({ ...VALID_POST, tags }).success,
    ).toBe(true)
    expect(
      createPostBodySchema.safeParse({
        ...VALID_POST,
        tags: [...tags, 'tag-10'],
      }).success,
    ).toBe(false)
  })

  it('rejects a tag with no ASCII form', () => {
    expect(
      createPostBodySchema.safeParse({ ...VALID_POST, tags: ['日本語'] })
        .success,
    ).toBe(false)
  })

  it('requires an excerpt to be between 1 and 250 characters', () => {
    expect(
      createPostBodySchema.safeParse({ ...VALID_POST, excerpt: '' }).success,
    ).toBe(false)
    expect(
      createPostBodySchema.safeParse({
        ...VALID_POST,
        excerpt: 'a'.repeat(251),
      }).success,
    ).toBe(false)
    expect(
      createPostBodySchema.safeParse({ ...VALID_POST, excerpt: 'a' }).success,
    ).toBe(true)
  })

  it('applies the image rules to the cover image', () => {
    expect(
      createPostBodySchema.safeParse({
        ...VALID_POST,
        coverImage: 'javascript:alert(1)',
      }).success,
    ).toBe(false)
  })
})

describe('updatePostBodySchema', () => {
  it('accepts an empty body, so every field is optional', () => {
    expect(updatePostBodySchema.parse({})).toEqual({})
  })

  it('still applies each field’s own rules when it is sent', () => {
    expect(updatePostBodySchema.safeParse({ title: '日本語' }).success).toBe(
      false,
    )
    expect(updatePostBodySchema.safeParse({ content: '  ' }).success).toBe(
      false,
    )
    expect(updatePostBodySchema.safeParse({ tags: [] }).success).toBe(false)
    expect(updatePostBodySchema.safeParse({ status: 'archived' }).success).toBe(
      false,
    )
  })
})

describe('postPageQuerySchema', () => {
  it('coerces the limit from the query string', () => {
    expect(postPageQuerySchema.parse({ limit: '25' }).limit).toBe(25)
  })

  it('defaults to ten per page', () => {
    expect(postPageQuerySchema.parse({}).limit).toBe(10)
  })

  it.each([
    ['zero', '0'],
    ['one above the maximum', '51'],
    ['a value that is not a number', 'many'],
  ])('rejects a limit of %s', (_case, limit) => {
    expect(postPageQuerySchema.safeParse({ limit }).success).toBe(false)
  })

  it('accepts the maximum page size', () => {
    expect(postPageQuerySchema.parse({ limit: '50' }).limit).toBe(50)
  })

  it('decodes a cursor it issued', () => {
    const at = new Date('2026-01-15T09:30:00.000Z')
    const id = '65f1c0de5a1e2b3c4d5e6f70'
    const cursor = Buffer.from(`${at.toISOString()}|${id}`).toString(
      'base64url',
    )

    expect(postPageQuerySchema.parse({ cursor }).cursor).toEqual({
      at,
      id: expect.anything(),
    })
  })

  // Falling back to the first page would loop the client over page one.
  it('rejects a malformed cursor instead of returning the first page', () => {
    const parsed = postPageQuerySchema.safeParse({ cursor: 'not-a-cursor' })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe('Invalid cursor')
  })
})

describe('listPostsQuerySchema', () => {
  it('trims the search term', () => {
    expect(listPostsQuerySchema.parse({ search: '  express  ' }).search).toBe(
      'express',
    )
  })

  it('rejects an empty search term', () => {
    expect(listPostsQuerySchema.safeParse({ search: '' }).success).toBe(false)
  })

  it('bounds the search term at 200 characters', () => {
    expect(
      listPostsQuerySchema.safeParse({ search: 'a'.repeat(201) }).success,
    ).toBe(false)
  })

  it('trims the tag slug and bounds it at 50 characters', () => {
    expect(listPostsQuerySchema.parse({ tag: '  node  ' }).tag).toBe('node')
    expect(
      listPostsQuerySchema.safeParse({ tag: 'a'.repeat(51) }).success,
    ).toBe(false)
  })
})
