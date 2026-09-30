import { afterEach, describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'
import type { CreatePostInput } from '@packages/shared'

import {
  InvalidPostIdError,
  PostForbiddenError,
  PostNotFoundError,
} from '#errors/post'
import { Post } from '#models/post'
import { Tag } from '#models/tag'
import {
  createPost,
  deletePost,
  getOwnedPostById,
  getPublishedPostBySlug,
  listPublishedPosts,
  listUserPosts,
  updatePost,
} from '#services/post'
import { createPost as storePost, createTag, createUser } from '#test/factories'
import { decodePostCursor } from '#utils/cursor'

// The write that the slug race loses is the one to interrupt: rejecting it with
// a duplicate on the slug index is exactly what MongoDB answers a lost race
// with, and it is the only error `createPost` treats as retryable.
afterEach(() => {
  vi.restoreAllMocks()
})

function duplicateKey(keyPattern: Record<string, number>) {
  return Object.assign(new Error('E11000 duplicate key error'), {
    code: 11000,
    keyPattern,
  })
}

const CONTENT = '# Heading\n\nSome body text.\n'
const INPUT: CreatePostInput = {
  title: 'Building a REST API',
  content: CONTENT,
  tags: ['node'],
}

async function namesOf(post: { tags: Types.ObjectId[] }): Promise<string[]> {
  const tags = await Tag.find({ _id: { $in: post.tags } }).lean()

  return tags.map((tag) => tag.name).sort()
}

async function slugsOf(post: { tags: Types.ObjectId[] }): Promise<string[]> {
  const tags = await Tag.find({ _id: { $in: post.tags } }).lean()

  return tags.map((tag) => tag.slug).sort()
}

describe('createPost defaults', () => {
  it('stores a draft with no cover image', async () => {
    const author = await createUser()

    const post = await createPost(author.id, INPUT)

    expect(post.status).toBe('draft')
    expect(post.publishedAt).toBeNull()
    expect(post.coverImage).toBe('')
  })

  // The API stores Markdown verbatim and never renders it, so the excerpt is a
  // plain slice: the leading `#` and the indentation survive.
  it('derives the excerpt from the Markdown, verbatim', async () => {
    const author = await createUser()
    const content = `  # Heading\n\n    indented code\n\n${'x'.repeat(400)}`

    const post = await createPost(author.id, { ...INPUT, content })

    expect(post.excerpt).toBe(content.slice(0, 250))
  })

  it('keeps an excerpt the request supplied', async () => {
    const author = await createUser()

    const post = await createPost(author.id, {
      ...INPUT,
      excerpt: 'Chosen by hand',
    })

    expect(post.excerpt).toBe('Chosen by hand')
  })

  it('stamps a publication date for a published post', async () => {
    const author = await createUser()

    const post = await createPost(author.id, { ...INPUT, status: 'published' })

    expect(post.publishedAt).toBeInstanceOf(Date)
  })

  // The author is the session, so a body claiming otherwise is ignored.
  it('takes the author from the argument and ignores one in the body', async () => {
    const author = await createUser()
    const impostor = await createUser()

    const post = await createPost(author.id, {
      ...INPUT,
      author: impostor.id,
    } as CreatePostInput)

    expect(String(post.author)).toBe(author.id)
  })
})

describe('createPost tags', () => {
  it('trims, lowercases and de-duplicates the submitted names', async () => {
    const author = await createUser()

    const post = await createPost(author.id, {
      ...INPUT,
      tags: [' Node ', 'node', 'NODE'],
    })

    expect(post.tags).toHaveLength(1)
    expect(await namesOf(post)).toEqual(['node'])
  })

  it('reuses a tag that already exists instead of creating a second one', async () => {
    const author = await createUser()
    const existing = await createTag('node')

    const post = await createPost(author.id, INPUT)

    expect(String(post.tags[0])).toBe(String(existing._id))
    await expect(Tag.countDocuments({})).resolves.toBe(1)
  })

  // Names stay readable, so two names that fold alike are kept apart.
  it('keeps distinct names that fold to the same slug apart', async () => {
    const author = await createUser()

    const post = await createPost(author.id, { ...INPUT, tags: ['C++', 'C#'] })

    expect(post.tags).toHaveLength(2)
    expect(new Set(await slugsOf(post)).size).toBe(2)
    expect(await namesOf(post)).toEqual(['c#', 'c++'])
  })
})

describe('createPost slugs', () => {
  it('gives a repeated title the next readable slug', async () => {
    const author = await createUser()

    const first = await createPost(author.id, INPUT)
    const second = await createPost(author.id, INPUT)

    expect(first.slug).toBe('building-a-rest-api')
    expect(second.slug).toBe('building-a-rest-api-1')
  })

  // Two requests can both read a slug as free and only the unique index stops
  // the second one, so the loop has to keep going rather than surface a 5xx.
  // Past the readable attempts it stops competing and appends a token.
  it('retries a lost race and settles on a token suffix', async () => {
    const author = await createUser()
    const create = vi
      .spyOn(Post, 'create')
      .mockRejectedValueOnce(duplicateKey({ slug: 1 }))
      .mockRejectedValueOnce(duplicateKey({ slug: 1 }))

    const post = await createPost(author.id, INPUT)

    expect(create).toHaveBeenCalledTimes(3)
    expect(post.slug).toMatch(/^building-a-rest-api-[0-9a-f]{10}$/)
  })

  // A genuine database fault must not be retried into a different slug.
  it('propagates a duplicate on another index on the first attempt', async () => {
    const author = await createUser()
    const create = vi
      .spyOn(Post, 'create')
      .mockRejectedValue(duplicateKey({ email: 1 }))

    await expect(createPost(author.id, INPUT)).rejects.toMatchObject({
      code: 11000,
    })
    expect(create).toHaveBeenCalledTimes(1)
  })

  // A post committed without its tags is the bug this guards: the post write
  // fails after the tags were created in the same transaction, so only the
  // rollback leaves the collection empty.
  it('persists no post and no tag when the post write fails', async () => {
    await expect(createPost('not-an-object-id', INPUT)).rejects.toThrow()

    await expect(Post.countDocuments({})).resolves.toBe(0)
    await expect(Tag.countDocuments({})).resolves.toBe(0)
  })
})

describe('updatePost', () => {
  it('never changes the slug, so a published URL stays valid', async () => {
    const author = await createUser()
    const post = await storePost(author, { title: 'Original title' })

    const updated = await updatePost(post.id, author.id, {
      title: 'A completely different title',
    })

    expect(updated.title).toBe('A completely different title')
    expect(updated.slug).toBe(post.slug)
  })

  it('re-derives the excerpt from new content, and keeps one that was sent', async () => {
    const author = await createUser()
    const post = await storePost(author, { content: 'Old body.' })

    const derived = await updatePost(post.id, author.id, {
      content: 'A longer replacement body.',
    })
    const supplied = await updatePost(post.id, author.id, {
      content: 'Another replacement body.',
      excerpt: 'Chosen by hand',
    })

    expect(derived.excerpt).toBe('A longer replacement body.')
    expect(supplied.excerpt).toBe('Chosen by hand')
  })

  it('leaves omitted fields alone', async () => {
    const author = await createUser()
    const post = await storePost(author, {
      excerpt: 'Kept excerpt',
      coverImage: 'https://cdn.example.com/a.png',
    })

    const updated = await updatePost(post.id, author.id, { title: 'New' })

    expect(updated.title).toBe('New')
    expect(updated.excerpt).toBe('Kept excerpt')
    expect(updated.coverImage).toBe('https://cdn.example.com/a.png')
  })

  it('stamps a fresh date on publication and clears it on unpublication', async () => {
    const author = await createUser()
    const post = await storePost(author, { status: 'draft' })

    const published = await updatePost(post.id, author.id, {
      status: 'published',
    })
    const unpublished = await updatePost(post.id, author.id, {
      status: 'draft',
    })

    expect(published.publishedAt).toBeInstanceOf(Date)
    expect(unpublished.publishedAt).toBeNull()
  })

  // The feed follows this date, so republishing has to move the post up. The
  // first date is written directly, which a stamp that reused the stored value
  // would leave untouched.
  it('stamps a new date on every republication', async () => {
    const author = await createUser()
    const original = new Date('2021-05-05T05:05:05.000Z')
    const post = await storePost(author, { publishedAt: original })

    await updatePost(post.id, author.id, { status: 'draft' })
    const republished = await updatePost(post.id, author.id, {
      status: 'published',
    })

    expect(republished.publishedAt?.toISOString()).not.toBe(
      original.toISOString(),
    )
    expect(republished.publishedAt?.getTime()).toBeGreaterThan(
      Date.parse('2021-06-01T00:00:00.000Z'),
    )
  })

  it('leaves the publication date alone when the status does not change', async () => {
    const author = await createUser()
    const publishedAt = new Date('2021-05-05T05:05:05.000Z')
    const post = await storePost(author, { publishedAt })

    const updated = await updatePost(post.id, author.id, {
      status: 'published',
      title: 'Edited later',
    })

    expect(updated.publishedAt?.toISOString()).toBe(publishedAt.toISOString())
  })

  // The tag document has to outlive its last post so the name can be reused.
  it('replaces the tag set without deleting the tags themselves', async () => {
    const author = await createUser()
    const post = await storePost(author, { tags: ['first'] })

    const updated = await updatePost(post.id, author.id, { tags: ['second'] })

    expect(await namesOf(updated)).toEqual(['second'])
    await expect(Tag.countDocuments({})).resolves.toBe(2)
  })

  // Creation rollback is covered above; this is the update path. Tags are
  // resolved before the post is saved, so a failed save must roll back the new
  // tag and leave the post untouched.
  it('rolls back a newly created tag when the final save fails', async () => {
    const author = await createUser()
    const post = await storePost(author, {
      title: 'Before',
      content: 'Before body.',
      excerpt: 'Before excerpt',
      tags: ['existing'],
    })
    const existingTagIds = post.tags.map((id) => String(id))

    // An over-long excerpt makes the final `post.save` fail validation after the
    // new tag has already been created inside the transaction.
    await expect(
      updatePost(post.id, author.id, {
        excerpt: 'x'.repeat(251),
        tags: ['brand-new'],
      }),
    ).rejects.toThrow()

    const stored = await Post.findById(post.id).lean()

    expect(stored?.title).toBe('Before')
    expect(stored?.content).toBe('Before body.')
    expect(stored?.excerpt).toBe('Before excerpt')
    expect(stored?.tags.map(String)).toEqual(existingTagIds)

    await expect(Tag.exists({ name: 'existing' })).resolves.not.toBeNull()
    await expect(Tag.exists({ name: 'brand-new' })).resolves.toBeNull()
  })

  it('answers the three ownership failures separately', async () => {
    const author = await createUser()
    const other = await createUser()
    const post = await storePost(author)

    await expect(updatePost('nope', author.id, {})).rejects.toBeInstanceOf(
      InvalidPostIdError,
    )
    await expect(
      updatePost(new Types.ObjectId().toHexString(), author.id, {}),
    ).rejects.toBeInstanceOf(PostNotFoundError)
    await expect(
      updatePost(post.id, other.id, { title: 'Not mine' }),
    ).rejects.toBeInstanceOf(PostForbiddenError)
  })
})

describe('deletePost', () => {
  it("removes the author's own post", async () => {
    const author = await createUser()
    const post = await storePost(author)

    await deletePost(post.id, author.id)

    await expect(Post.findById(post.id)).resolves.toBeNull()
  })

  it('refuses another author and leaves the post in place', async () => {
    const author = await createUser()
    const other = await createUser()
    const post = await storePost(author)

    await expect(deletePost(post.id, other.id)).rejects.toBeInstanceOf(
      PostForbiddenError,
    )
    await expect(Post.findById(post.id)).resolves.not.toBeNull()
  })

  it('reports an unknown post as not found', async () => {
    const author = await createUser()

    await expect(
      deletePost(new Types.ObjectId().toHexString(), author.id),
    ).rejects.toBeInstanceOf(PostNotFoundError)
  })
})

describe('listPublishedPosts', () => {
  it("returns published posts only, even beside the same author's drafts", async () => {
    const author = await createUser()
    const published = await storePost(author, { status: 'published' })
    await storePost(author, { status: 'draft' })

    const page = await listPublishedPosts({}, { limit: 10 })

    expect(page.posts.map((post) => post._id.toString())).toEqual([
      published._id.toString(),
    ])
  })

  it('orders by publication date, newest first, with the id breaking ties', async () => {
    const author = await createUser()
    const shared = new Date('2024-01-01T00:00:00.000Z')
    const firstTie = await storePost(author, { publishedAt: shared })
    const secondTie = await storePost(author, { publishedAt: shared })
    const newest = await storePost(author, {
      publishedAt: new Date('2025-01-01T00:00:00.000Z'),
    })

    const page = await listPublishedPosts({}, { limit: 10 })
    const ids = page.posts.map((post) => post._id.toString())

    expect(ids[0]).toBe(newest._id.toString())
    expect(ids.slice(1)).toEqual(
      [firstTie, secondTie]
        .map((post) => post._id.toString())
        .sort()
        .reverse(),
    )
  })

  // The feed follows the publication date, so a post republished today sits
  // above one that was published earlier today.
  it('orders by publication date, not by when the post was created', async () => {
    const author = await createUser()
    const republished = await storePost(author, {
      publishedAt: new Date('2025-06-01T00:00:00.000Z'),
    })
    const publishedEarlier = await storePost(author, {
      publishedAt: new Date('2024-06-01T00:00:00.000Z'),
    })

    const page = await listPublishedPosts({}, { limit: 10 })

    expect(page.posts.map((post) => post._id.toString())).toEqual([
      republished._id.toString(),
      publishedEarlier._id.toString(),
    ])
  })

  it('matches a search against the title', async () => {
    const author = await createUser()
    await storePost(author, { title: 'Express routing in practice' })
    await storePost(author, { title: 'PostgreSQL index tuning' })

    const page = await listPublishedPosts({ search: 'routing' }, { limit: 10 })

    expect(page.posts.map((post) => post.title)).toEqual([
      'Express routing in practice',
    ])
  })

  it('narrows to a tag and stays empty for an unknown one', async () => {
    const author = await createUser()
    await storePost(author, { tags: ['node'] })
    await storePost(author, { tags: ['other'] })

    const page = await listPublishedPosts({ tag: 'node' }, { limit: 10 })
    const unknown = await listPublishedPosts({ tag: 'nope' }, { limit: 10 })

    expect(page.posts).toHaveLength(1)
    expect(unknown).toEqual({ posts: [], nextCursor: null })
  })

  it('restricts to one author’s published posts', async () => {
    const author = await createUser()
    const other = await createUser()
    const mine = await storePost(author)
    await storePost(other)

    const page = await listPublishedPosts({ author: author.id }, { limit: 10 })

    expect(page.posts.map((post) => post._id.toString())).toEqual([
      mine._id.toString(),
    ])
  })

  it('pages with a cursor, visiting every post exactly once', async () => {
    const author = await createUser()
    const posts = await Promise.all(
      Array.from({ length: 7 }, (_, index) =>
        storePost(author, {
          publishedAt: new Date(`2024-0${(index % 9) + 1}-01T00:00:00.000Z`),
        }),
      ),
    )

    const seen: string[] = []
    const cursors: (string | null)[] = []

    for (
      let page = await listPublishedPosts({}, { limit: 3 });
      cursors.length < 10;
    ) {
      seen.push(...page.posts.map((post) => post._id.toString()))
      cursors.push(page.nextCursor)

      if (page.nextCursor === null) {
        break
      }

      page = await listPublishedPosts(
        {},
        { limit: 3, cursor: decodePostCursor(page.nextCursor) ?? undefined },
      )
    }

    expect(cursors).toHaveLength(3)
    expect(cursors.at(-1)).toBeNull()
    expect(seen.sort()).toEqual(posts.map((post) => post._id.toString()).sort())
    expect(new Set(seen).size).toBe(seen.length)
  })

  // The `_id` half of the cursor is what keeps a tie from being read twice.
  it('pages across a tie on the sort field', async () => {
    const author = await createUser()
    const shared = new Date('2024-03-03T00:00:00.000Z')
    const posts = await Promise.all([
      storePost(author, { publishedAt: shared }),
      storePost(author, { publishedAt: shared }),
      storePost(author, { publishedAt: shared }),
    ])

    const first = await listPublishedPosts({}, { limit: 2 })
    const cursor = decodePostCursor(first.nextCursor ?? '')
    const second = await listPublishedPosts(
      {},
      { limit: 2, cursor: cursor ?? undefined },
    )

    expect(first.posts).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()
    expect(second.posts).toHaveLength(1)
    expect(second.nextCursor).toBeNull()
    expect(
      [...first.posts, ...second.posts]
        .map((post) => post._id.toString())
        .sort(),
    ).toEqual(posts.map((post) => post._id.toString()).sort())
  })
})

describe('listUserPosts', () => {
  // The dashboard is the owner's own view, so unlike the feed it shows drafts.
  it("includes the owner's drafts", async () => {
    const author = await createUser()
    const other = await createUser()
    const draft = await storePost(author, { status: 'draft' })
    const published = await storePost(author, { status: 'published' })
    await storePost(other)

    const page = await listUserPosts(author.id, { limit: 10 })
    const ids = page.posts.map((post) => post._id.toString())

    expect(ids).toHaveLength(2)
    expect(ids).toContain(draft._id.toString())
    expect(ids).toContain(published._id.toString())
  })

  // The newest edit is on top, which is not the same as the newest
  // publication: a post written first can carry the later date.
  it('orders by creation date, not by publication date', async () => {
    const author = await createUser()
    const writtenFirst = await storePost(author, {
      publishedAt: new Date('2025-06-01T00:00:00.000Z'),
    })
    const writtenLast = await storePost(author, {
      publishedAt: new Date('2024-06-01T00:00:00.000Z'),
    })

    const page = await listUserPosts(author.id, { limit: 10 })

    expect(page.posts.map((post) => post._id.toString())).toEqual([
      writtenLast._id.toString(),
      writtenFirst._id.toString(),
    ])
  })

  // The list is keyed on `createdAt`, not the id, so the two orders are made to
  // disagree: an order by `_id` alone could not produce this list.
  it('orders by creation date, not by id', async () => {
    const author = await createUser()
    const storedFirst = await storePost(author, {
      createdAt: new Date('2023-01-01T00:00:00.000Z'),
    })
    const storedLast = await storePost(author, {
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    })

    const page = await listUserPosts(author.id, { limit: 10 })

    expect(page.posts.map((post) => post._id.toString())).toEqual([
      storedLast._id.toString(),
      storedFirst._id.toString(),
    ])
  })

  // The dashboard pages on `createdAt` while the feed pages on `publishedAt`,
  // so the keyset walk is proved here rather than assumed from the feed's.
  it('pages with a cursor, visiting every post exactly once', async () => {
    const author = await createUser()
    // Every post shares one creation date, so the id alone settles the order and
    // a page boundary cannot hide a duplicate or drop one.
    const shared = new Date('2024-06-01T00:00:00.000Z')
    const posts = await Promise.all(
      Array.from({ length: 7 }, (_, index) =>
        storePost(author, {
          status: index % 2 === 0 ? 'draft' : 'published',
          createdAt: shared,
        }),
      ),
    )

    const seen: string[] = []
    const cursors: (string | null)[] = []

    for (
      let page = await listUserPosts(author.id, { limit: 3 });
      cursors.length < 10;
    ) {
      seen.push(...page.posts.map((post) => post._id.toString()))
      cursors.push(page.nextCursor)

      if (page.nextCursor === null) {
        break
      }

      page = await listUserPosts(author.id, {
        limit: 3,
        cursor: decodePostCursor(page.nextCursor) ?? undefined,
      })
    }

    expect(cursors).toHaveLength(3)
    expect(cursors.at(-1)).toBeNull()
    expect(seen.sort()).toEqual(posts.map((post) => post._id.toString()).sort())
    expect(new Set(seen).size).toBe(seen.length)
  })
})

describe('detail reads', () => {
  it('returns a published post with its author and tags populated', async () => {
    const author = await createUser({ name: 'Ada Lovelace' })
    const post = await storePost(author, { tags: ['node'] })

    const found = await getPublishedPostBySlug(post.slug)

    expect(found.content).toBe(post.content)
    expect(found.author.name).toBe('Ada Lovelace')
    expect(found.tags.map((tag) => tag.slug)).toEqual(['node'])
  })

  // The response must not reveal that the draft exists.
  it('reports a draft and an unknown slug the same way', async () => {
    const author = await createUser()
    const draft = await storePost(author, { status: 'draft' })

    await expect(getPublishedPostBySlug(draft.slug)).rejects.toBeInstanceOf(
      PostNotFoundError,
    )
    await expect(getPublishedPostBySlug('nope')).rejects.toBeInstanceOf(
      PostNotFoundError,
    )
  })

  // A draft is exactly the private case the detail read exists for: published
  // posts are already public, so only a draft's body needs the ownership check.
  it("returns an owned draft with its body, and nobody else's", async () => {
    const author = await createUser()
    const other = await createUser()
    const post = await storePost(author, {
      status: 'draft',
      content: 'Private body.',
    })

    const owned = await getOwnedPostById(post.id, author.id)

    expect(String(owned._id)).toBe(post.id)
    expect(owned.status).toBe('draft')
    expect(owned.content).toBe('Private body.')
    await expect(getOwnedPostById('nope', author.id)).rejects.toBeInstanceOf(
      InvalidPostIdError,
    )
    await expect(
      getOwnedPostById(new Types.ObjectId().toHexString(), author.id),
    ).rejects.toBeInstanceOf(PostNotFoundError)
    await expect(getOwnedPostById(post.id, other.id)).rejects.toBeInstanceOf(
      PostForbiddenError,
    )
  })
})
