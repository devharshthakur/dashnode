import { describe, expect, it } from 'vitest'
import { Types } from 'mongoose'

import { InvalidUserIdError, UserNotFoundError } from '#errors/user'
import { getPublicUserProfile } from '#services/user'
import { createPost, createUser } from '#test/factories'
import { decodePostCursor } from '#utils/cursor'
import { postCursorFor } from '#utils/post'

describe('getPublicUserProfile', () => {
  it('rejects an id that is not an ObjectId', async () => {
    await expect(
      getPublicUserProfile('nope', { limit: 10 }),
    ).rejects.toBeInstanceOf(InvalidUserIdError)
  })

  it('reports an unknown id as not found', async () => {
    await expect(
      getPublicUserProfile(new Types.ObjectId().toHexString(), { limit: 10 }),
    ).rejects.toBeInstanceOf(UserNotFoundError)
  })

  // A profile is a projection: the email and the hash never load at all.
  it('returns only the public fields', async () => {
    const user = await createUser({
      name: 'Ada Lovelace',
      bio: 'Writes about engines',
      avatarUrl: 'https://cdn.example.com/a.png',
    })

    const profile = await getPublicUserProfile(user.id, { limit: 10 })

    expect(Object.keys(profile.user).sort()).toEqual([
      'avatarUrl',
      'bio',
      'id',
      'name',
    ])
    expect(profile.user).toEqual({
      id: user.id,
      name: 'Ada Lovelace',
      bio: 'Writes about engines',
      avatarUrl: 'https://cdn.example.com/a.png',
    })
  })

  it('never carries the email or a password hash', async () => {
    const user = await createUser()

    const profile = await getPublicUserProfile(user.id, { limit: 10 })

    expect(profile.user).not.toHaveProperty('email')
    expect(profile.user).not.toHaveProperty('password')
  })

  // A draft must not reach a public profile.
  it('lists the author’s published posts only', async () => {
    const user = await createUser()
    const other = await createUser()
    const published = await createPost(user, { status: 'published' })
    await createPost(user, { status: 'draft' })
    await createPost(other)

    const profile = await getPublicUserProfile(user.id, { limit: 10 })

    expect(profile.posts.map((post) => post._id.toString())).toEqual([
      published._id.toString(),
    ])
  })

  it('passes the requested page through to the list query', async () => {
    const user = await createUser()
    await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        createPost(user, {
          publishedAt: new Date(`2024-0${index + 1}-01T00:00:00.000Z`),
        }),
      ),
    )

    const first = await getPublicUserProfile(user.id, { limit: 2 })
    const last = first.posts.at(-1)
    const cursor = decodePostCursor(
      (last && postCursorFor(last, 'publishedAt')) ?? '',
    )
    const second = await getPublicUserProfile(user.id, {
      limit: 2,
      cursor: cursor ?? undefined,
    })

    expect(first.posts).toHaveLength(2)
    expect(first.nextCursor).not.toBeNull()
    expect(second.posts).toHaveLength(1)
    expect(second.nextCursor).toBeNull()
  })
})
