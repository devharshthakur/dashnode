import { describe, expect, it } from 'vitest'
import { Types } from 'mongoose'

import { User } from '#models/user'
import { api, loggedInSession, registeredSession } from '#test/app'
import { createPost, createUser, TEST_PASSWORD } from '#test/factories'

const ORIGIN = 'http://localhost:5173'
const FOREIGN_ORIGIN = 'https://evil.example.com'

let emails = 0

async function session() {
  emails += 1

  return registeredSession({ email: `user-${emails}@example.com` })
}

/**
 * A session for a user whose profile already carries the fields an edit has to
 * preserve. Registration does not accept them, so the user is created first and
 * the session comes from logging in.
 */
async function sessionWithProfile(fields: {
  name?: string
  bio?: string
  avatarUrl?: string
}) {
  emails += 1
  const user = await createUser({ ...fields, email: `user-${emails}@x.com` })

  return loggedInSession({ email: user.email, password: TEST_PASSWORD })
}

describe('GET /api/users/:id', () => {
  it('answers 200 with a public profile and a page of posts', async () => {
    const user = await createUser({
      name: 'Ada Lovelace',
      bio: 'Writes about engines',
      avatarUrl: 'https://cdn.example.com/a.png',
    })
    const post = await createPost(user)

    const response = await api().get(`/api/users/${user.id}`)

    expect(response.status).toBe(200)
    expect(response.body.user).toEqual({
      id: user.id,
      name: 'Ada Lovelace',
      bio: 'Writes about engines',
      avatarUrl: 'https://cdn.example.com/a.png',
    })
    expect(response.body.posts).toHaveLength(1)
    expect(response.body.posts[0].id).toBe(post.id)
    expect(response.body).toHaveProperty('nextCursor')
    // The exact equality above already excludes them, but the raw response text
    // must not leak the address either.
    expect(response.body.user).not.toHaveProperty('email')
    expect(response.body.user).not.toHaveProperty('password')
    expect(response.text).not.toContain(user.email)
  })

  // Two exclusions in one case, and each needs its own fixture: a profile that
  // stopped filtering by author, and one that stopped filtering by status.
  it('never lists a draft or another author’s post on a public profile', async () => {
    const user = await createUser()
    const other = await createUser()
    const published = await createPost(user, { status: 'published' })
    await createPost(user, { status: 'draft' })
    await createPost(other, { status: 'published' })

    const response = await api().get(`/api/users/${user.id}`)

    expect(response.body.posts.map((post: { id: string }) => post.id)).toEqual([
      published.id,
    ])
  })

  it('answers 400 for an id that is not an ObjectId and 404 for an unknown one', async () => {
    const malformed = await api().get('/api/users/not-an-id')
    const unknown = await api().get(
      `/api/users/${new Types.ObjectId().toHexString()}`,
    )

    expect(malformed.status).toBe(400)
    expect(malformed.body).toEqual({ error: 'Invalid user id' })
    expect(unknown.status).toBe(404)
    expect(unknown.body).toEqual({ error: 'User not found' })
  })

  it('follows the returned cursor to the next page', async () => {
    const user = await createUser()
    const posts = await Promise.all([
      createPost(user, { publishedAt: new Date('2024-01-01T00:00:00.000Z') }),
      createPost(user, { publishedAt: new Date('2024-02-01T00:00:00.000Z') }),
      createPost(user, { publishedAt: new Date('2024-03-01T00:00:00.000Z') }),
    ])

    const page = await api().get(`/api/users/${user.id}?limit=2`)
    const badLimit = await api().get(`/api/users/${user.id}?limit=51`)
    const badCursor = await api().get(
      `/api/users/${user.id}?cursor=not-a-cursor`,
    )

    expect(page.body.posts).toHaveLength(2)
    expect(page.body.nextCursor).not.toBeNull()
    expect(badLimit.status).toBe(400)
    expect(badCursor.status).toBe(400)

    // The cursor the route returned is what the client sends back; asserting
    // the second page here proves the route forwards it rather than only the
    // service reconstructing one.
    const second = await api().get(
      `/api/users/${user.id}?limit=2&cursor=${page.body.nextCursor}`,
    )

    expect(second.status).toBe(200)
    expect(second.body.nextCursor).toBeNull()
    const ids = [...page.body.posts, ...second.body.posts].map(
      (post: { id: string }) => post.id,
    )
    expect(ids).toEqual([posts[2].id, posts[1].id, posts[0].id])
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('PUT /api/users/me', () => {
  it('answers 401 without a session', async () => {
    const response = await api()
      .put('/api/users/me')
      .set('Origin', ORIGIN)
      .send({ bio: 'New bio' })

    expect(response.status).toBe(401)
  })

  it('answers 403 without a trusted origin, even with a session', async () => {
    const signedIn = await session()

    const response = await signedIn.agent
      .put('/api/users/me')
      .set('Origin', FOREIGN_ORIGIN)
      .send({ bio: 'New bio' })

    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'Forbidden' })
  })

  // #28: a partial update sets only what it carries.
  it('changes one field and leaves the others alone', async () => {
    const signedIn = await sessionWithProfile({
      name: 'Ada Lovelace',
      bio: 'Original bio',
      avatarUrl: 'https://cdn.example.com/original.png',
    })

    const response = await signedIn.agent
      .put('/api/users/me')
      .set('Origin', ORIGIN)
      .send({ bio: 'New bio' })

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({
      name: 'Ada Lovelace',
      bio: 'New bio',
      avatarUrl: 'https://cdn.example.com/original.png',
    })
    expect(response.body.user).not.toHaveProperty('password')
    const stored = await User.findById(signedIn.user.id).lean()
    expect(stored?.bio).toBe('New bio')
    expect(stored?.name).toBe('Ada Lovelace')
    expect(stored?.avatarUrl).toBe('https://cdn.example.com/original.png')
  })

  it.each([
    ['an empty body', {}, 'Provide at least one of name, bio, or avatarUrl'],
    ['a name over 100 characters', { name: 'a'.repeat(101) }, 'name'],
    [
      'an avatar that is not an absolute http(s) URL',
      { avatarUrl: 'not-a-url' },
      'avatarUrl',
    ],
  ])('answers 400 for %s', async (_case, body, message) => {
    const signedIn = await session()

    const response = await signedIn.agent
      .put('/api/users/me')
      .set('Origin', ORIGIN)
      .send(body)

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Validation Error')
    expect(JSON.stringify(response.body.details)).toContain(message)
  })

  it('clears the avatar with an empty string', async () => {
    const signedIn = await sessionWithProfile({
      avatarUrl: 'https://cdn.example.com/a.png',
    })

    const response = await signedIn.agent
      .put('/api/users/me')
      .set('Origin', ORIGIN)
      .send({ avatarUrl: '' })

    expect(response.status).toBe(200)
    expect(response.body.user.avatarUrl).toBe('')
    const stored = await User.findById(signedIn.user.id).lean()
    expect(stored?.avatarUrl).toBe('')
  })

  // The route's own `404` is unreachable through the session: `requireAuth`
  // loads the user first, so a deleted user is refused at the guard instead.
  it('refuses a session whose user no longer exists', async () => {
    const signedIn = await session()

    await User.deleteOne({ _id: signedIn.user.id })
    const response = await signedIn.agent
      .put('/api/users/me')
      .set('Origin', ORIGIN)
      .send({ bio: 'New bio' })

    expect(response.status).toBe(401)
    expect(response.body).toEqual({ error: 'Unauthorized' })
  })
})
