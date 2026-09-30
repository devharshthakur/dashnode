import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { Post } from '#models/post'
import { Tag } from '#models/tag'
import { User } from '#models/user'
import { createUser } from '#test/factories'
import { DATABASE_TEST_FILES, PURE_TEST_FILES } from '#test/projects'

// Proves the harness builds the unique indexes before the first test: a
// duplicate has to be rejected every run, so a write that relies on an index
// cannot pass or fail depending on timing. Transactions, population, and
// commit/rollback are exercised by the service integration tests instead.
describe('test harness', () => {
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

  // The two indexes are distinct, and each stops a different write: duplicating
  // both fields at once could only prove that *some* unique index rejected it.
  it('rejects a duplicate tag name through the name index', async () => {
    await expect(
      Tag.create({ name: 'reused', slug: 'first' }),
    ).resolves.toBeTruthy()

    await expect(
      Tag.create({ name: 'reused', slug: 'second' }),
    ).rejects.toMatchObject({ code: 11000 })
  })

  it('rejects a duplicate tag slug through the slug index', async () => {
    await expect(
      Tag.create({ name: 'reused', slug: 'shared' }),
    ).resolves.toBeTruthy()

    await expect(
      Tag.create({ name: 'other', slug: 'shared' }),
    ).rejects.toMatchObject({ code: 11000 })
  })
})

describe('test project classification', () => {
  // A test file that matches neither project's `include` would silently stop
  // running, so the projects are held to the files that actually exist.
  it('assigns every test file to exactly one project', () => {
    const discovered = readdirSync(join(import.meta.dirname, '..'), {
      recursive: true,
    })
      .map(String)
      .filter((path) => path.endsWith('.test.ts'))
      .map((path) => `src/${path.replaceAll('\\', '/')}`)
      .sort()

    expect(discovered).toEqual(
      [...PURE_TEST_FILES, ...DATABASE_TEST_FILES].sort(),
    )
  })
})
