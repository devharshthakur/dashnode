import { describe, expect, it } from 'vitest'
import type { Types } from 'mongoose'

import { Post } from '#models/post'
import { Tag } from '#models/tag'
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
  it('commits every document a transaction writes', async () => {
    const { user, tag } = await withTransaction(async (session) => {
      const [user] = await User.create(
        [
          {
            name: 'In A Transaction',
            email: 'tx@example.com',
            password: 'hash',
          },
        ],
        { session },
      )
      const [tag] = await Tag.create(
        [{ name: 'transactional', slug: 'transactional' }],
        { session },
      )

      return { user, tag }
    })

    expect(await User.exists({ _id: user._id })).not.toBeNull()
    expect(await Tag.exists({ _id: tag._id })).not.toBeNull()
  })

  // The half of a transaction that matters: a failure part way through has to
  // undo the writes that already succeeded, which is the property the post
  // service relies on when its post write fails after its tags were created.
  it('rolls back every document when a transaction fails', async () => {
    await expect(
      withTransaction(async (session) => {
        await User.create(
          [
            {
              name: 'Rolled Back',
              email: 'rollback@example.com',
              password: 'hash',
            },
          ],
          { session },
        )

        throw new Error('the second write failed')
      }),
    ).rejects.toThrow('the second write failed')

    await expect(User.exists({ email: 'rollback@example.com' })).resolves.toBe(
      null,
    )
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

  // The post service resolves a slug by reading, then writes; only this index
  // stops two concurrent creates from claiming the same one.
  it('rejects a duplicate post slug through its unique index', async () => {
    const author = await createUser()
    const post = {
      title: 'First',
      slug: 'claimed-twice',
      content: 'Body.',
      status: 'published' as const,
      publishedAt: new Date(),
      author: author._id,
    }

    await expect(Post.create(post)).resolves.toBeTruthy()
    await expect(Post.create(post)).rejects.toMatchObject({ code: 11000 })
  })

  it('rejects a duplicate tag name and slug through their unique indexes', async () => {
    const tag = { name: 'reused', slug: 'reused' }

    await expect(Tag.create(tag)).resolves.toBeTruthy()
    await expect(Tag.create(tag)).rejects.toMatchObject({ code: 11000 })
    // A second tag that folds to the same slug under a different name has to be
    // rejected too, which is what `generateUniqueSlug` reads before it writes.
    await expect(
      Tag.create({ name: 'reused again', slug: 'reused' }),
    ).rejects.toMatchObject({ code: 11000 })
  })
})
