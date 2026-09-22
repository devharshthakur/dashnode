import {
  isValidObjectId,
  type ClientSession,
  type HydratedDocument,
  type Types,
} from 'mongoose'
import type { CreatePostInput, UpdatePostInput } from '@packages/shared'

import { Post, type PostDocument } from '#models/post'
import { Tag } from '#models/tag'
import { generateUniqueSlug, slugify } from '#utils/slug'
import { withTransaction } from '#utils/transaction'

const EXCERPT_MAX_LENGTH = 250

export class InvalidPostIdError extends Error {
  constructor() {
    super('Invalid post id')
    this.name = 'InvalidPostIdError'
  }
}

export class PostNotFoundError extends Error {
  constructor() {
    super('Post not found')
    this.name = 'PostNotFoundError'
  }
}

export class PostForbiddenError extends Error {
  constructor() {
    super('You can only modify your own posts')
    this.name = 'PostForbiddenError'
  }
}

/**
 * Builds the feed preview from raw Markdown when the client did not supply an
 * excerpt. The API stores Markdown verbatim and never parses or renders it, so
 * this applies only the model's 250-char cap; the client owns rendering.
 */
function deriveExcerpt(content: string): string {
  return content.slice(0, EXCERPT_MAX_LENGTH)
}

/**
 * Maps tag names or slugs to Tag ids, reusing a document whose slug already
 * matches and creating the tag otherwise. Callers pass the surrounding
 * transaction session so post and tag writes commit together.
 */
async function resolveTagIds(
  tags: string[],
  session: ClientSession,
): Promise<Types.ObjectId[]> {
  const slugs = [...new Set(tags.map((tag) => slugify(tag)))]
  const tagIds: Types.ObjectId[] = []

  for (const slug of slugs) {
    const tag = await Tag.findOneAndUpdate(
      { slug },
      { $setOnInsert: { name: slug, slug } },
      { upsert: true, new: true, session },
    ).orFail()

    tagIds.push(tag._id)
  }

  return tagIds
}

/**
 * Loads a post and verifies the caller authored it before any mutation. Unknown
 * ids and malformed ids are distinguished from the ownership failure so routes
 * can answer with 404, 400, and 403 respectively.
 */
async function loadOwnedPost(
  postId: string,
  userId: string,
  session?: ClientSession,
): Promise<HydratedDocument<PostDocument>> {
  if (!isValidObjectId(postId)) {
    throw new InvalidPostIdError()
  }

  const post = await Post.findById(postId).session(session ?? null)

  if (!post) {
    throw new PostNotFoundError()
  }

  if (String(post.author) !== userId) {
    throw new PostForbiddenError()
  }

  return post
}

/**
 * Creates a post owned by `authorId`. The slug is derived from the title, the
 * author comes from the session (never the request body), and tags are linked
 * or created in the same transaction so a failed write leaves nothing behind.
 */
export async function createPost(
  authorId: string,
  input: CreatePostInput,
): Promise<HydratedDocument<PostDocument>> {
  const slug = await generateUniqueSlug(input.title, Post)

  return withTransaction(async (session) => {
    const tags = await resolveTagIds(input.tags, session)

    const [post] = await Post.create(
      [
        {
          title: input.title,
          slug,
          content: input.content,
          excerpt: input.excerpt ?? deriveExcerpt(input.content),
          coverImage: input.coverImage ?? '',
          status: input.status ?? 'draft',
          author: authorId,
          tags,
        },
      ],
      { session },
    )

    return post
  })
}

/**
 * Updates a post after the ownership check. The slug stays stable across edits
 * so published URLs do not break. A new body refreshes the derived excerpt
 * unless the request supplied one explicitly.
 */
export async function updatePost(
  postId: string,
  userId: string,
  input: UpdatePostInput,
): Promise<HydratedDocument<PostDocument>> {
  return withTransaction(async (session) => {
    const post = await loadOwnedPost(postId, userId, session)

    if (input.title !== undefined) {
      post.title = input.title
    }

    if (input.content !== undefined) {
      post.content = input.content

      if (input.excerpt === undefined) {
        post.excerpt = deriveExcerpt(input.content)
      }
    }

    if (input.excerpt !== undefined) {
      post.excerpt = input.excerpt
    }

    if (input.coverImage !== undefined) {
      post.coverImage = input.coverImage
    }

    if (input.status !== undefined) {
      post.status = input.status
    }

    if (input.tags !== undefined) {
      post.tags = await resolveTagIds(input.tags, session)
    }

    await post.save({ session })

    return post
  })
}

/** Deletes a post after the ownership check. */
export async function deletePost(
  postId: string,
  userId: string,
): Promise<void> {
  const post = await loadOwnedPost(postId, userId)

  await post.deleteOne()
}
