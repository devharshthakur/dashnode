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
import { generateUniqueSlug } from '#utils/slug'
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
 * Maps tag names to Tag ids, reusing a tag whose display name already matches
 * and creating one otherwise. A tag's name is stored apart from its URL slug,
 * so names such as `Node.js` stay readable and distinct names that slugify
 * alike (`C++`, `C#`) get a stable unique suffix instead of merging. Reuse is
 * keyed on the name so re-selecting a tag stays stable even after its slug was
 * suffixed. Callers pass the surrounding transaction session so post and tag
 * writes commit together.
 */
async function resolveTagIds(
  tags: string[],
  session: ClientSession,
): Promise<Types.ObjectId[]> {
  const names = [...new Set(tags.map((tag) => tag.trim().toLowerCase()))]
  const tagIds: Types.ObjectId[] = []

  for (const name of names) {
    const existing = await Tag.findOne({ name }).session(session)

    if (existing) {
      tagIds.push(existing._id)
      continue
    }

    const slug = await generateUniqueSlug(name, Tag, session)
    const [tag] = await Tag.create([{ name, slug }], { session })

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
 * A post created as published is stamped with its publication date; a draft
 * starts with none.
 */
export async function createPost(
  authorId: string,
  input: CreatePostInput,
): Promise<HydratedDocument<PostDocument>> {
  const slug = await generateUniqueSlug(input.title, Post)
  const status = input.status ?? 'draft'

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
          status,
          publishedAt: status === 'published' ? new Date() : null,
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
 * unless the request supplied one explicitly. A draft→published transition
 * stamps a fresh publication date; editing an already published post keeps its
 * original date. Republishing an unpublished post is treated as a new
 * publication and therefore gets a new date.
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

    if (input.status !== undefined && input.status !== post.status) {
      post.status = input.status
      // Public feeds order by this date, so every fresh publication stamps it
      // and an unpublish clears it. Edits that keep the status leave it alone.
      post.publishedAt = input.status === 'published' ? new Date() : null
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
 * Loads the public feed: published posts only, most recently published first.
 * The status filter is applied before any search or tag clause so drafts can
 * never leak into a public response. Author and tags are populated for feed
 * cards.
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
    .sort({ publishedAt: -1 })
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

export async function getOwnedPostById(
  postId: string,
  userId: string,
): Promise<PostDetailSource> {
  if (!isValidObjectId(postId)) {
    throw new InvalidPostIdError()
  }

  const post = await Post.findById(postId)
    .populate<{ author: PopulatedAuthor }>('author', 'name avatarUrl')
    .populate<{ tags: PopulatedTag[] }>('tags', 'name slug')
    .lean()

  if (!post) {
    throw new PostNotFoundError()
  }

  if (String(post.author._id) !== userId) {
    throw new PostForbiddenError()
  }

  return post
}
