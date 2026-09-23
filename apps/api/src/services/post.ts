import {
  isValidObjectId,
  type ClientSession,
  type HydratedDocument,
  type QueryFilter,
  type Types,
} from 'mongoose'
import type { CreatePostInput, UpdatePostInput } from '@packages/shared'

import {
  InvalidPostIdError,
  PostForbiddenError,
  PostNotFoundError,
} from '#errors/post'
import { Post, type PostDocument } from '#models/post'
import { Tag } from '#models/tag'
import {
  type PopulatedAuthor,
  type PopulatedTag,
  type PostCardSource,
  type PostDetailSource,
} from '#utils/post'
import { generateUniqueSlug, slugify } from '#utils/slug'
import { withTransaction } from '#utils/transaction'

const EXCERPT_MAX_LENGTH = 250

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
      { upsert: true, returnDocument: 'after', session },
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

export interface ListPublishedPostsQuery {
  /** Keyword matched against post titles via the title text index. */
  search?: string
  /** Tag slug; an unknown slug yields an empty feed, never an error. */
  tag?: string
}

/**
 * Loads the public feed: published posts only, newest first. The status filter
 * is applied before any search or tag clause so drafts can never leak into a
 * public response. Author and tags are populated for feed cards.
 */
export async function listPublishedPosts(
  query: ListPublishedPostsQuery,
): Promise<PostCardSource[]> {
  const filter: QueryFilter<PostDocument> = { status: 'published' }

  if (query.search !== undefined) {
    filter.$text = { $search: query.search }
  }

  if (query.tag !== undefined) {
    const tag = await Tag.findOne({ slug: query.tag }).lean()

    if (!tag) {
      return []
    }

    filter.tags = tag._id
  }

  const posts = await Post.find(filter)
    .sort({ createdAt: -1 })
    .populate<{ author: PopulatedAuthor }>('author', 'name avatarUrl')
    .populate<{ tags: PopulatedTag[] }>('tags', 'name slug')
    .lean()

  return posts
}

/** Loads all posts owned by a user, newest first, for the private dashboard. */
export async function listUserPosts(userId: string): Promise<PostCardSource[]> {
  const posts = await Post.find({ author: userId })
    .sort({ createdAt: -1 })
    .populate<{ author: PopulatedAuthor }>('author', 'name avatarUrl')
    .populate<{ tags: PopulatedTag[] }>('tags', 'name slug')
    .lean()

  return posts
}

/** Loads one public post by slug; drafts are indistinguishable from missing posts. */
export async function getPublishedPostBySlug(
  slug: string,
): Promise<PostDetailSource> {
  const post = await Post.findOne({ slug, status: 'published' })
    .populate<{ author: PopulatedAuthor }>('author', 'name avatarUrl')
    .populate<{ tags: PopulatedTag[] }>('tags', 'name slug')
    .lean()

  if (!post) {
    throw new PostNotFoundError()
  }

  return post
}
