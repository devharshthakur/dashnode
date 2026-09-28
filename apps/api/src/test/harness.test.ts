import { describe, expect, it } from 'vitest'
import type { Types } from 'mongoose'

import { Post } from '#models/post'
import { User } from '#models/user'
import { createPost, createUser } from '#test/factories'
import { withTransaction } from '#utils/transaction'

// Proves the harness itself: a real connection, real indexes, and a replica set
// that accepts transactions. Everything from here on depends on this file
// passing before the rest of the suite can mean anything.
describe('test harness', () => {
  it('reads a post back with a populated author and tags', async () => {
    const user = await createUser({ name: 'Ada Lovelace' })
    const post = await createPost(user, { tags: ['express', 'node'] })

    const found = await Post.findById(post._id)
      .populate<{ author: { _id: Types.ObjectId; name: string } }>(
        'author',
        'name',
      )
      .populate<{
        tags: { _id: Types.ObjectId; name: string; slug: string }[]
      }>('tags', 'name slug')
      .lean()

    expect(found?.title).toBe(post.title)
    expect(found?.author.name).toBe('Ada Lovelace')
    expect(found?.tags.map((tag) => tag.name).sort()).toEqual([
      'express',
      'node',
    ])
  })

  // The reason the harness asks for a replica set rather than a plain
  // in-memory server: post and tag writes run inside `withTransaction`.
  it('commits a multi-document transaction', async () => {
    const [user] = await withTransaction(async (session) =>
      User.create(
        [
          {
            name: 'In A Transaction',
            email: 'tx@example.com',
            password: 'hash',
          },
        ],
        { session },
      ),
    )

    expect(await User.exists({ _id: user._id })).not.toBeNull()
  })

  // The reason indexes are synced before the first test rather than built in
  // the background: a duplicate email has to be rejected every run.
  it('rejects a duplicate email through its unique index', async () => {
    await User.create({
      name: 'First',
      email: 'taken@example.com',
      password: 'hash',
    })

    await expect(
      User.create({
        name: 'Second',
        email: 'taken@example.com',
        password: 'hash',
      }),
    ).rejects.toMatchObject({ code: 11000 })
  })
})
