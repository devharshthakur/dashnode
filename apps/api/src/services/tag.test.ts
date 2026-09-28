import { describe, expect, it } from 'vitest'

import { Post } from '#models/post'
import { Tag } from '#models/tag'
import { listTags } from '#services/tag'
import { createPost, createTag, createUser } from '#test/factories'

interface ListedTag {
  name: string
  slug: string
  postCount: number
}

async function directory(): Promise<ListedTag[]> {
  const tags = await listTags()

  return tags.map((tag) => ({
    name: tag.name,
    slug: tag.slug,
    postCount: tag.postCount,
  }))
}

describe('listTags', () => {
  it('lists a tag a published post uses', async () => {
    const author = await createUser()
    await createPost(author, { tags: ['node'] })

    await expect(directory()).resolves.toEqual([
      { name: 'node', slug: 'node', postCount: 1 },
    ])
  })

  // A tag coined while writing must not be visible to a visitor.
  it('leaves out a tag only a draft uses', async () => {
    const author = await createUser()
    await createPost(author, { status: 'draft', tags: ['secret-project'] })

    await expect(directory()).resolves.toEqual([])
  })

  it('counts the published posts using a tag, sorted by name', async () => {
    const author = await createUser()
    await createPost(author, { tags: ['node', 'express'] })
    await createPost(author, { tags: ['node'] })
    await createPost(author, { status: 'draft', tags: ['node'] })

    await expect(directory()).resolves.toEqual([
      { name: 'express', slug: 'express', postCount: 1 },
      { name: 'node', slug: 'node', postCount: 2 },
    ])
  })

  // The aggregation groups on the post-and-tag pair, so a post that lists one
  // tag twice is still one post.
  it('counts a post carrying the same tag twice once', async () => {
    const author = await createUser()
    const tag = await createTag('node')
    await Post.create({
      title: 'Linked twice',
      slug: 'linked-twice',
      content: 'Body.',
      excerpt: 'Body.',
      status: 'published',
      publishedAt: new Date(),
      author: author._id,
      tags: [tag._id, tag._id],
    })

    await expect(directory()).resolves.toEqual([
      { name: 'node', slug: 'node', postCount: 1 },
    ])
  })

  it('returns nothing for a database with nothing published', async () => {
    // A tag nobody has posted with: the early return has to hold.
    await createTag('orphan')

    await expect(directory()).resolves.toEqual([])
  })

  // The transition #27 decided on, and the one most likely to regress: the
  // directory follows the post without any cleanup step of its own.
  it('follows a draft being published and unpublished again', async () => {
    const author = await createUser()
    const post = await createPost(author, {
      status: 'draft',
      tags: ['secret-project'],
    })

    await Post.findByIdAndUpdate(post._id, {
      $set: { status: 'published', publishedAt: new Date() },
    })
    await expect(directory()).resolves.toEqual([
      { name: 'secret-project', slug: 'secret-project', postCount: 1 },
    ])

    await Post.findByIdAndUpdate(post._id, {
      $set: { status: 'draft', publishedAt: null },
    })
    await expect(directory()).resolves.toEqual([])
    // The document itself is kept, so the name can be used again.
    await expect(Tag.countDocuments({ name: 'secret-project' })).resolves.toBe(
      1,
    )
  })

  it('drops a tag from the directory once no published post uses it', async () => {
    const author = await createUser()
    const post = await createPost(author, { tags: ['node', 'express'] })

    await Post.findByIdAndUpdate(post._id, {
      $set: { tags: [post.tags[0]] },
    })
    await expect(directory()).resolves.toEqual([
      { name: 'node', slug: 'node', postCount: 1 },
    ])

    await Post.findByIdAndDelete(post._id)
    await expect(directory()).resolves.toEqual([])
    await expect(Tag.countDocuments({})).resolves.toBe(2)
  })
})
