import { describe, expect, it } from 'vitest'

import { Post } from '#models/post'
import { api, trustedOrigin } from '#test/app'
import { createPost, createTag, createUser } from '#test/factories'

interface ListedTag {
  id: string
  name: string
  slug: string
  postCount: number
}

async function directory(): Promise<ListedTag[]> {
  const response = await api().get('/api/tags')

  return response.body.tags
}

describe('GET /api/tags', () => {
  it('answers 200 with an id, name, slug and count per tag', async () => {
    const user = await createUser()
    await createPost(user, { tags: ['node'] })

    const response = await api().get('/api/tags')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      tags: [
        { id: expect.any(String), name: 'node', slug: 'node', postCount: 1 },
      ],
    })
  })

  // A zero-count entry would leak the name of a tag coined on a draft.
  it('omits a tag only a draft uses, name and all', async () => {
    const user = await createUser()
    await createPost(user, { status: 'draft', tags: ['secret-project'] })

    const response = await api().get('/api/tags')

    expect(response.body).toEqual({ tags: [] })
    expect(response.text).not.toContain('secret-project')
  })

  it('counts published posts, and a post carrying one tag twice counts once', async () => {
    const user = await createUser()
    const node = await createTag('node')
    await createPost(user, { tags: ['node'] })
    await createPost(user, { status: 'draft', tags: ['node'] })
    await Post.create({
      title: 'Linked twice',
      slug: 'linked-twice',
      content: 'Body.',
      excerpt: 'Body.',
      status: 'published',
      publishedAt: new Date(),
      author: user._id,
      tags: [node._id, node._id],
    })

    await expect(directory()).resolves.toEqual([
      { id: String(node._id), name: 'node', slug: 'node', postCount: 2 },
    ])
  })

  it('sorts by name and answers an empty list when nothing is published', async () => {
    const user = await createUser()
    await createPost(user, { tags: ['node', 'express', 'database'] })

    const sorted = await directory()
    await Post.updateMany({}, { $set: { status: 'draft' } })
    const empty = await directory()

    expect(sorted.map((tag) => tag.name)).toEqual([
      'database',
      'express',
      'node',
    ])
    expect(empty).toEqual([])
  })

  it('follows a draft being published and unpublished again', async () => {
    const user = await createUser()
    const post = await createPost(user, {
      status: 'draft',
      tags: ['secret-project'],
    })

    await Post.findByIdAndUpdate(post._id, {
      $set: { status: 'published', publishedAt: new Date() },
    })
    const published = await directory()

    await Post.findByIdAndUpdate(post._id, {
      $set: { status: 'draft', publishedAt: null },
    })
    const unpublished = await directory()

    expect(published.map((tag) => tag.name)).toEqual(['secret-project'])
    expect(published[0]?.postCount).toBe(1)
    expect(unpublished).toEqual([])
  })
})

describe('GET /api/tags/:slug/posts', () => {
  it('answers 200 with cards and a cursor, and no stored body', async () => {
    const user = await createUser()
    const post = await createPost(user, {
      tags: ['node'],
      content: 'A stored body.',
    })

    const response = await api().get('/api/tags/node/posts')

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('posts')
    expect(response.body).toHaveProperty('nextCursor')
    expect(response.body.posts[0]).toMatchObject({ id: post.id })
    expect(response.body.posts[0]).not.toHaveProperty('content')
    expect(response.text).not.toContain('A stored body.')
  })

  it('lists only the published posts carrying the tag', async () => {
    const user = await createUser()
    const published = await createPost(user, { tags: ['node'] })
    await createPost(user, { status: 'draft', tags: ['node'] })
    await createPost(user, { tags: ['other'] })

    const response = await api().get('/api/tags/node/posts')

    expect(response.body.posts.map((post: { id: string }) => post.id)).toEqual([
      published.id,
    ])
  })

  it('answers an empty list for an unknown slug, not a 404', async () => {
    const response = await api().get('/api/tags/no-such-tag/posts')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ posts: [], nextCursor: null })
  })

  it.each([
    ['zero', 'limit=0'],
    ['one above the maximum', 'limit=51'],
    ['a value that is not a number', 'limit=many'],
  ])('answers 400 for a limit of %s', async (_case, query) => {
    const response = await api().get(`/api/tags/node/posts?${query}`)

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Validation Error')
  })

  it('answers 400 for a malformed cursor', async () => {
    const response = await api().get('/api/tags/node/posts?cursor=not-a-cursor')

    expect(response.status).toBe(400)
  })

  it('pages through every post with that tag exactly once', async () => {
    const user = await createUser()
    // Created up front: the factory resolves a tag by name, and five concurrent
    // `createPost` calls would otherwise all try to create it.
    await createTag('node')
    const posts = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createPost(user, {
          tags: ['node'],
          publishedAt: new Date(`2024-0${index + 1}-01T00:00:00.000Z`),
        }),
      ),
    )

    const seen: string[] = []
    let query = '?limit=2'
    let pages = 0

    for (;;) {
      const response = await api().get(`/api/tags/node/posts${query}`)
      seen.push(...response.body.posts.map((post: { id: string }) => post.id))
      pages += 1

      if (response.body.nextCursor === null || pages >= 10) {
        break
      }

      query = `?limit=2&cursor=${response.body.nextCursor}`
    }

    expect(pages).toBe(3)
    expect(seen.sort()).toEqual(posts.map((post) => post.id).sort())
    expect(new Set(seen).size).toBe(seen.length)
  })
})

describe('CORS', () => {
  // The CORS layer and the origin middleware are separate mechanisms: this one
  // decides what a browser may read, `requireTrustedOrigin` decides what the
  // server will do. Both are load-bearing.
  it('allows a trusted origin to read the response with credentials', async () => {
    const response = await api().get('/api/tags').set('Origin', trustedOrigin())

    expect(response.headers['access-control-allow-origin']).toBe(
      trustedOrigin(),
    )
    expect(response.headers['access-control-allow-credentials']).toBe('true')
  })

  it('does not allow a foreign origin to read the response', async () => {
    const response = await api()
      .get('/api/tags')
      .set('Origin', 'https://evil.example.com')

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})
