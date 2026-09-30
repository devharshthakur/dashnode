import { describe, expect, it } from 'vitest'
import { Types } from 'mongoose'

import { InvalidUserIdError, UserNotFoundError } from '#errors/user'
import { getPublicUserProfile } from '#services/user'
import { createPost, createUser } from '#test/factories'
import { decodePostCursor } from '#utils/cursor'

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

  it('follows the returned cursor to the next page', async () => {
    const user = await createUser()
    const posts = await Promise.all(
      Array.from({ length: 3 }, (_, index) =>
        createPost(user, {
          publishedAt: new Date(`2024-0${index + 1}-01T00:00:00.000Z`),
        }),
      ),
    )

    const first = await getPublicUserProfile(user.id, { limit: 2 })
    // The service's own cursor is the one the client would send back; building
    // a fresh one from the last post would pass even if `nextCursor` were wrong.
    const cursor = decodePostCursor(first.nextCursor ?? '')

    expect(cursor).not.toBeNull()
    const second = await getPublicUserProfile(user.id, {
      limit: 2,
      cursor: cursor ?? undefined,
    })

    expect(first.posts).toHaveLength(2)
    expect(second.posts).toHaveLength(1)
    expect(second.nextCursor).toBeNull()
    // Exact order and no repetition: two page lengths would also be satisfied
    // by a dropped post or a duplicate. Posts were created in ascending
    // `publishedAt` order, and the profile lists newest first.
    const ids = [...first.posts, ...second.posts].map((post) =>
      post._id.toString(),
    )
    const expected = [...posts].reverse().map((post) => post._id.toString())
    expect(ids).toEqual(expected)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
