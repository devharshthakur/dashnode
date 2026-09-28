import { describe, expect, it } from 'vitest'
import { Types } from 'mongoose'

import { Post } from '#models/post'
import type { Session } from '#test/app'
import { api, registeredSession, trustedOrigin } from '#test/app'
import { createPost, createUser } from '#test/factories'

const ORIGIN = 'http://localhost:5173'
const FOREIGN_ORIGIN = 'https://evil.example.com'
const MARKDOWN = '# Heading\n\n    indented code\n\n```js\nconst a = 1\n```\n'
const NEW_POST = {
  title: 'Building a REST API',
  content: MARKDOWN,
  tags: ['node'],
}

let emails = 0

async function author(email?: string) {
  emails += 1

  return registeredSession({ email: email ?? `post-${emails}@example.com` })
}

/** A post stores its author as a reference, and a session carries only an id. */
function authorRef(session: Session) {
  return new Types.ObjectId(session.user.id)
}

/** A `POST`/`PUT`/`DELETE` from a signed-in agent, with the trusted origin. */
function write(
  session: Awaited<ReturnType<typeof author>>,
  method: 'post' | 'put' | 'delete',
  path: string,
  origin: string | null = ORIGIN,
) {
  const request = session.agent[method](path)

  if (origin !== null) {
    request.set('Origin', origin)
  }

  return request
}

describe('GET /api/posts', () => {
  it('answers 200 with cards and a cursor', async () => {
    const user = await createUser()
    const post = await createPost(user, {
      status: 'published',
      tags: ['node'],
    })

    const response = await api().get('/api/posts')

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('posts')
    expect(response.body).toHaveProperty('nextCursor')
    expect(response.body.posts[0]).toEqual({
      id: post.id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      coverImage: post.coverImage,
      status: 'published',
      author: { id: user.id, name: user.name, avatarUrl: user.avatarUrl },
      tags: [
        {
          id: String(post.tags[0]),
          name: 'node',
          slug: 'node',
        },
      ],
      publishedAt: post.publishedAt?.toISOString(),
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    })
  })

  // A card query projects card fields only, so the body is never read.
  it('never returns a stored Markdown body', async () => {
    const user = await createUser()
    await createPost(user, { content: 'A secret draft body.' })

    const response = await api().get('/api/posts')

    expect(response.body.posts[0]).not.toHaveProperty('content')
    expect(response.text).not.toContain('A secret draft body.')
  })

  it('never lists a draft, even beside its author’s published post', async () => {
    const user = await createUser()
    const published = await createPost(user, { status: 'published' })
    await createPost(user, { status: 'draft' })

    const response = await api().get('/api/posts')

    expect(response.body.posts.map((post: { id: string }) => post.id)).toEqual([
      published.id,
    ])
  })

  it('filters by title search and by tag slug', async () => {
    const user = await createUser()
    await createPost(user, { title: 'Express routing in practice' })
    await createPost(user, { title: 'PostgreSQL tuning', tags: ['db'] })

    const search = await api().get('/api/posts?search=routing')
    const byTag = await api().get('/api/posts?tag=db')
    const unknownTag = await api().get('/api/posts?tag=nope')

    expect(
      search.body.posts.map((post: { title: string }) => post.title),
    ).toEqual(['Express routing in practice'])
    expect(byTag.body.posts).toHaveLength(1)
    // An unknown slug is an empty feed, never an error.
    expect(unknownTag.status).toBe(200)
    expect(unknownTag.body).toEqual({ posts: [], nextCursor: null })
  })

  it('honors the page size', async () => {
    const user = await createUser()
    await Promise.all([
      createPost(user, { publishedAt: new Date('2024-01-01T00:00:00Z') }),
      createPost(user, { publishedAt: new Date('2024-02-01T00:00:00Z') }),
      createPost(user, { publishedAt: new Date('2024-03-01T00:00:00Z') }),
    ])

    const response = await api().get('/api/posts?limit=2')

    expect(response.body.posts).toHaveLength(2)
    expect(response.body.nextCursor).not.toBeNull()
  })

  it.each([
    ['zero', 'limit=0'],
    ['one above the maximum', 'limit=51'],
    ['a value that is not a number', 'limit=many'],
  ])('answers 400 for a limit of %s', async (_case, query) => {
    const response = await api().get(`/api/posts?${query}`)

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Validation Error')
  })

  // Falling back to the first page would loop a client over page one forever.
  it('answers 400 for a malformed cursor rather than the first page', async () => {
    const response = await api().get('/api/posts?cursor=not-a-cursor')

    expect(response.status).toBe(400)
    expect(response.body.details[0].message).toBe('Invalid cursor')
  })

  it('walks every post exactly once and ends with a null cursor', async () => {
    const user = await createUser()
    const posts = await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        createPost(user, {
          publishedAt: new Date(`2024-0${index + 1}-01T00:00:00.000Z`),
        }),
      ),
    )

    const seen: string[] = []
    let cursor: string | null = '/api/posts?limit=2'
    let pages = 0

    while (cursor !== null && pages < 10) {
      const response = await api().get(cursor)
      seen.push(...response.body.posts.map((post: { id: string }) => post.id))
      cursor =
        response.body.nextCursor === null
          ? null
          : `${cursor.split('&cursor=')[0]}&cursor=${response.body.nextCursor}`
      pages += 1
    }

    expect(pages).toBe(3)
    expect(seen.sort()).toEqual(posts.map((post) => post.id).sort())
    expect(new Set(seen).size).toBe(seen.length)
  })
})

describe('GET /api/posts/:slug', () => {
  it('answers 200 with the Markdown body verbatim', async () => {
    const user = await createUser()
    const post = await createPost(user, {
      status: 'published',
      content: MARKDOWN,
    })

    const response = await api().get(`/api/posts/${post.slug}`)

    expect(response.status).toBe(200)
    expect(response.body.post.content).toBe(MARKDOWN)
    expect(response.body.post.author).toHaveProperty('id', user.id)
  })

  // The same answer for both, so the response cannot reveal that a draft exists.
  it('answers 404 for a draft’s slug and for an unknown one', async () => {
    const user = await createUser()
    const draft = await createPost(user, { status: 'draft' })

    const published = await api().get(`/api/posts/${draft.slug}`)
    const unknown = await api().get('/api/posts/no-such-post')

    expect(published.status).toBe(404)
    expect(unknown.status).toBe(404)
    expect(published.body).toEqual(unknown.body)
  })

  // The dashboard has to stay out of the `/:slug` space: `mine/list` reaching
  // the auth guard proves it was not read as a slug.
  it('does not let the mine segment be read as a slug', async () => {
    const response = await api().get('/api/posts/mine/list')

    expect(response.status).toBe(401)
  })
})

describe('POST /api/posts', () => {
  it('answers 401 without a session', async () => {
    const response = await api()
      .post('/api/posts')
      .set('Origin', ORIGIN)
      .send(NEW_POST)

    expect(response.status).toBe(401)
  })

  it('answers 403 without a trusted origin, even with a session', async () => {
    const session = await author()

    const response = await write(
      session,
      'post',
      '/api/posts',
      FOREIGN_ORIGIN,
    ).send(NEW_POST)

    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'Forbidden' })
  })

  it('creates a draft by default', async () => {
    const session = await author()

    const response = await write(session, 'post', '/api/posts').send(NEW_POST)

    expect(response.status).toBe(201)
    expect(response.body.post.status).toBe('draft')
    expect(response.body.post.publishedAt).toBeNull()
  })

  it('publishes when asked to', async () => {
    const session = await author()

    const response = await write(session, 'post', '/api/posts').send({
      ...NEW_POST,
      status: 'published',
    })

    expect(response.status).toBe(201)
    expect(response.body.post.status).toBe('published')
    expect(Number.isNaN(Date.parse(response.body.post.publishedAt))).toBe(false)
  })

  it('stores the Markdown body unaltered', async () => {
    const session = await author()

    const response = await write(session, 'post', '/api/posts').send(NEW_POST)

    expect(response.body.post.content).toBe(MARKDOWN)
    const stored = await Post.findById(response.body.post.id).lean()
    expect(stored?.content).toBe(MARKDOWN)
  })

  // The author is the session; a body claiming otherwise is ignored.
  it('takes the author from the session, not the body', async () => {
    const session = await author()
    const other = await createUser()

    const response = await write(session, 'post', '/api/posts').send({
      ...NEW_POST,
      author: other.id,
    })

    expect(response.body.post.author).toBe(session.user.id)
  })

  it.each([
    ['a missing tag list', { tags: [] }, 'tags'],
    ['a title that slugifies to nothing', { title: '日本語' }, 'title'],
    ['a whitespace-only body', { content: '   ' }, 'content'],
    [
      'a cover image that is not http(s)',
      { coverImage: 'javascript:alert(1)' },
      'coverImage',
    ],
  ])('answers 400 with details for %s', async (_case, override, path) => {
    const session = await author()

    const response = await write(session, 'post', '/api/posts').send({
      ...NEW_POST,
      ...override,
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Validation Error')
    expect(
      response.body.details.some(
        (detail: { path: string }) => detail.path === path,
      ),
    ).toBe(true)
  })

  // The documented outcome of two requests for the same new title: both are
  // stored, and neither answer is a `5xx`.
  it('stores two posts with the same new title on title and title-1', async () => {
    const session = await author()

    const first = await write(session, 'post', '/api/posts').send(NEW_POST)
    const second = await write(session, 'post', '/api/posts').send(NEW_POST)

    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    expect(first.body.post.slug).toBe('building-a-rest-api')
    expect(second.body.post.slug).toBe('building-a-rest-api-1')
  })
})

describe('PUT /api/posts/:id', () => {
  it('lets the author edit the post and stores the change', async () => {
    const session = await author()
    const { post } = (await write(session, 'post', '/api/posts').send(NEW_POST))
      .body

    const response = await write(session, 'put', `/api/posts/${post.id}`).send({
      title: 'An edited title',
    })

    expect(response.status).toBe(200)
    expect(response.body.post.title).toBe('An edited title')
    const stored = await Post.findById(post.id).lean()
    expect(stored?.title).toBe('An edited title')
  })

  // Re-read after the 403: the status alone would not show a write that
  // happened anyway.
  it('refuses another user and leaves the post unchanged', async () => {
    const session = await author()
    const other = await author()
    const post = await createPost(authorRef(session), { title: 'Untouched' })

    const response = await write(other, 'put', `/api/posts/${post.id}`).send({
      title: 'Hijacked',
    })

    expect(response.status).toBe(403)
    expect(response.body).toEqual({
      error: 'You can only modify your own posts',
    })
    const stored = await Post.findById(post.id).lean()
    expect(stored?.title).toBe('Untouched')
  })

  it('answers 404 for an unknown id and 400 for one that is not an ObjectId', async () => {
    const session = await author()

    const unknown = await write(
      session,
      'put',
      `/api/posts/${new Types.ObjectId().toHexString()}`,
    ).send({ title: 'New' })
    const malformed = await write(session, 'put', '/api/posts/not-an-id').send({
      title: 'New',
    })

    expect(unknown.status).toBe(404)
    expect(malformed.status).toBe(400)
  })

  it('answers 400 for an invalid body', async () => {
    const session = await author()
    const post = await createPost(authorRef(session))

    const response = await write(session, 'put', `/api/posts/${post.id}`).send({
      content: '   ',
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Validation Error')
  })

  it('stamps a publication date and clears it again', async () => {
    const session = await author()
    const post = await createPost(authorRef(session), { status: 'draft' })

    const published = await write(session, 'put', `/api/posts/${post.id}`).send(
      { status: 'published' },
    )
    const unpublished = await write(
      session,
      'put',
      `/api/posts/${post.id}`,
    ).send({ status: 'draft' })

    expect(Number.isNaN(Date.parse(published.body.post.publishedAt))).toBe(
      false,
    )
    expect(unpublished.body.post.publishedAt).toBeNull()
  })

  it('answers 401 without a session and 403 without a trusted origin', async () => {
    const post = await createPost(await createUser())

    const anonymous = await api()
      .put(`/api/posts/${post.id}`)
      .set('Origin', ORIGIN)
      .send({ title: 'New' })
    const session = await author()
    const foreign = await write(
      session,
      'put',
      `/api/posts/${post.id}`,
      FOREIGN_ORIGIN,
    ).send({ title: 'New' })

    expect(anonymous.status).toBe(401)
    expect(foreign.status).toBe(403)
  })
})

describe('DELETE /api/posts/:id', () => {
  it('lets the author delete the post', async () => {
    const session = await author()
    const post = await createPost(authorRef(session))

    const response = await write(session, 'delete', `/api/posts/${post.id}`)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ message: 'Post deleted' })
    await expect(Post.findById(post.id)).resolves.toBeNull()
  })

  it('refuses another user and leaves the post in place', async () => {
    const session = await author()
    const other = await author()
    const post = await createPost(authorRef(session))

    const response = await write(other, 'delete', `/api/posts/${post.id}`)

    expect(response.status).toBe(403)
    await expect(Post.findById(post.id)).resolves.not.toBeNull()
  })

  it('answers 404 for an unknown id and 400 for one that is not an ObjectId', async () => {
    const session = await author()

    const unknown = await write(
      session,
      'delete',
      `/api/posts/${new Types.ObjectId().toHexString()}`,
    )
    const malformed = await write(session, 'delete', '/api/posts/not-an-id')

    expect(unknown.status).toBe(404)
    expect(malformed.status).toBe(400)
  })

  it('answers 401 without a session and 403 without a trusted origin', async () => {
    const post = await createPost(await createUser())

    const anonymous = await api()
      .delete(`/api/posts/${post.id}`)
      .set('Origin', ORIGIN)
    const session = await author()
    const foreign = await write(
      session,
      'delete',
      `/api/posts/${post.id}`,
      FOREIGN_ORIGIN,
    )

    expect(anonymous.status).toBe(401)
    expect(foreign.status).toBe(403)
  })
})

describe('GET /api/posts/mine/list', () => {
  it('answers 401 without a session', async () => {
    const response = await api().get('/api/posts/mine/list')

    expect(response.status).toBe(401)
  })

  it('lists drafts and published posts, newest first', async () => {
    const session = await author()
    const draft = await createPost(authorRef(session), { status: 'draft' })
    const published = await createPost(authorRef(session), {
      status: 'published',
    })

    const response = await session.agent.get('/api/posts/mine/list')

    expect(response.status).toBe(200)
    expect(response.body.posts.map((post: { id: string }) => post.id)).toEqual([
      published.id,
      draft.id,
    ])
  })

  it('never lists another user’s posts', async () => {
    const session = await author()
    const mine = await createPost(authorRef(session))
    await createPost(await createUser())

    const response = await session.agent.get('/api/posts/mine/list')

    expect(response.body.posts.map((post: { id: string }) => post.id)).toEqual([
      mine.id,
    ])
  })

  it('applies the same page rules as the public feed', async () => {
    const session = await author()
    await Promise.all([
      createPost(authorRef(session)),
      createPost(authorRef(session)),
      createPost(authorRef(session)),
    ])

    const page = await session.agent.get('/api/posts/mine/list?limit=2')
    const badLimit = await session.agent.get('/api/posts/mine/list?limit=0')
    const badCursor = await session.agent.get(
      '/api/posts/mine/list?cursor=not-a-cursor',
    )

    expect(page.body.posts).toHaveLength(2)
    expect(page.body.nextCursor).not.toBeNull()
    expect(badLimit.status).toBe(400)
    expect(badCursor.status).toBe(400)
  })
})

describe('GET /api/posts/mine/:id', () => {
  it('answers the author with the post and its body', async () => {
    const session = await author()
    const post = await createPost(authorRef(session), {
      content: 'Private body.',
    })

    const response = await session.agent.get(`/api/posts/mine/${post.id}`)

    expect(response.status).toBe(200)
    expect(response.body.post.content).toBe('Private body.')
  })

  it('answers 403 for another user and 404 for an unknown id', async () => {
    const session = await author()
    const other = await author()
    const post = await createPost(authorRef(session))

    const foreign = await other.agent.get(`/api/posts/mine/${post.id}`)
    const unknown = await session.agent.get(
      `/api/posts/mine/${new Types.ObjectId().toHexString()}`,
    )

    expect(foreign.status).toBe(403)
    expect(unknown.status).toBe(404)
  })

  it('answers 400 for an id that is not an ObjectId', async () => {
    const session = await author()

    const response = await session.agent.get('/api/posts/mine/not-an-id')

    expect(response.status).toBe(400)
  })

  it('answers 401 without a session', async () => {
    const post = await createPost(await createUser())

    const response = await api().get(`/api/posts/mine/${post.id}`)

    expect(response.status).toBe(401)
  })
})

describe('a trusted origin is what the write routes accept', () => {
  it('comes from the configured CORS list', () => {
    expect(trustedOrigin()).toBe(ORIGIN)
  })
})
