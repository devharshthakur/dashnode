import {
  isValidObjectId,
  type ClientSession,
  type HydratedDocument,
  type QueryFilter,
  type Types,
} from 'mongoose'
import type { CreatePostInput, UpdatePostInput } from '@packages/shared'

import { logger } from '#config/logger'
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
  type PostCardPage,
  type PostDetailSource,
  type PostPageQuery,
  type PostSortField,
  POST_CARD_FIELDS,
  postCursorFor,
} from '#utils/post'
import {
  appendUniqueSuffix,
  generateUniqueSlug,
  isDuplicateSlugError,
  slugify,
} from '#utils/slug'
import { withTransaction } from '#utils/transaction'

const EXCERPT_MAX_LENGTH = 250

/**
 * How many attempts at creating a post read the stored slugs before giving up on
 * a readable one. A request that only ever reads can keep competing with the
 * requests that are still writing, so this is small on purpose: past it the
 * slug carries a token instead, which resolves the race outright.
 */
const READABLE_SLUG_ATTEMPTS = 2

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
 *
 * The slug is read before it is written, so two requests for the same new title
 * can pick the same one. The unique index on `slug` is the final protection, and
 * a request it rejects simply takes a different slug and writes again, so every
 * concurrent create ends up stored under a slug of its own. Only that one error
 * is retried; any other database failure propagates untouched.
 */
export async function createPost(
  authorId: string,
  input: CreatePostInput,
): Promise<HydratedDocument<PostDocument>> {
  const base = slugify(input.title)

  for (let attempt = 1; ; attempt += 1) {
    // The first attempts keep the slug readable, reading what is stored so the
    // request that lost a race lands on `title-1`. After that the request stops
    // competing for a readable slug and takes one carrying a token of its own,
    // which no other request can be holding — so the write cannot be refused
    // again, and this never runs out of attempts.
    const slug =
      attempt <= READABLE_SLUG_ATTEMPTS
        ? await generateUniqueSlug(input.title, Post)
        : appendUniqueSuffix(base)

    try {
      return await writePost(authorId, input, slug)
    } catch (error) {
      if (!isDuplicateSlugError(error)) {
        throw error
      }

      logger.warn(
        { attempt },
        'Post slug already taken by a concurrent request, retrying',
      )
    }
  }
}

/** Stores the post under `slug`, tagging and writing it in one transaction. */
async function writePost(
  authorId: string,
  input: CreatePostInput,
  slug: string,
): Promise<HydratedDocument<PostDocument>> {
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
  /** Author id; set when a public profile asks for that author's posts. */
  author?: string
}

/**
 * Reads one page of post cards. Lists page by keyset over `(sortField, _id)`
 * descending, so each page costs the same no matter how deep the client has
 * paged and ties keep a deterministic order. One extra row is read to learn
 * whether a next page exists without counting the whole result.
 */
async function findPostCardPage(
  filter: QueryFilter<PostDocument>,
  sortField: PostSortField,
  page: PostPageQuery,
): Promise<PostCardPage> {
  if (page.cursor) {
    filter.$or = [
      { [sortField]: { $lt: page.cursor.at } },
      { [sortField]: page.cursor.at, _id: { $lt: page.cursor.id } },
    ]
  }

  const posts = await Post.find(filter)
    .select(POST_CARD_FIELDS)
    .sort({ [sortField]: -1, _id: -1 })
    .limit(page.limit + 1)
    .populate<{ author: PopulatedAuthor }>('author', 'name avatarUrl')
    .populate<{ tags: PopulatedTag[] }>('tags', 'name slug')
    .lean()

  const hasNextPage = posts.length > page.limit
  const pagePosts = posts.slice(0, page.limit)
  const last = pagePosts.at(-1)

  return {
    posts: pagePosts,
    nextCursor: hasNextPage && last ? postCursorFor(last, sortField) : null,
  }
}

/**
 * Loads one page of the public feed: published posts only, most recently
 * published first. The status filter is applied before any search, tag, or
 * author clause so drafts can never leak into a public response.
 */
export async function listPublishedPosts(
  query: ListPublishedPostsQuery,
  page: PostPageQuery,
): Promise<PostCardPage> {
  const filter: QueryFilter<PostDocument> = { status: 'published' }

  if (query.search !== undefined) {
    filter.$text = { $search: query.search }
  }

  if (query.tag !== undefined) {
    const tag = await Tag.findOne({ slug: query.tag }).lean()

    if (!tag) {
      return { posts: [], nextCursor: null }
    }

    filter.tags = tag._id
  }

  if (query.author !== undefined) {
    filter.author = query.author
  }

  return findPostCardPage(filter, 'publishedAt', page)
}

/**
 * Loads one page of a user's posts, drafts included, newest first, for the
 * private dashboard.
 */
export async function listUserPosts(
  userId: string,
  page: PostPageQuery,
): Promise<PostCardPage> {
  return findPostCardPage({ author: userId }, 'createdAt', page)
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
