import type {
  PostCardDto,
  PostDetailDto,
  PostDto,
  PostStatus,
} from '@packages/shared'
import type { HydratedDocument, Types } from 'mongoose'

import type { PostDocument } from '#models/post'

/**
 * Maps a post document to the shared wire contract: `id` instead of `_id`, no
 * `__v`, ISO timestamps, and relations as id strings.
 */
export function toPostDto(post: HydratedDocument<PostDocument>): PostDto {
  return {
    id: String(post._id),
    title: post.title,
    slug: post.slug,
    content: post.content,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    status: post.status,
    author: String(post.author),
    tags: post.tags.map((tag) => String(tag)),
    createdAt: (post.get('createdAt') as Date).toISOString(),
    updatedAt: (post.get('updatedAt') as Date).toISOString(),
  }
}

/** Author projection populated onto public post reads. */
export interface PopulatedAuthor {
  _id: Types.ObjectId
  name: string
  avatarUrl: string
}

/** Tag projection populated onto public post reads. */
export interface PopulatedTag {
  _id: Types.ObjectId
  name: string
  slug: string
}

/**
 * Lean post with populated relations, as returned by the public read queries:
 * feed-card fields only, timestamps as Date instances.
 */
export interface PostCardSource {
  _id: Types.ObjectId
  title: string
  slug: string
  excerpt: string
  coverImage: string
  status: PostStatus
  author: PopulatedAuthor
  tags: PopulatedTag[]
  createdAt: Date
  updatedAt: Date
}

/** Lean post detail with populated author and tag projections. */
export interface PostDetailSource extends PostCardSource {
  content: string
}

/**
 * Maps a populated post to the public feed-card contract: author and tags as
 * embedded summaries, no Markdown body, ISO timestamps.
 */
export function toPostCardDto(post: PostCardSource): PostCardDto {
  return {
    id: String(post._id),
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    status: post.status,
    author: {
      id: String(post.author._id),
      name: post.author.name,
      avatarUrl: post.author.avatarUrl,
    },
    tags: post.tags.map((tag) => ({
      id: String(tag._id),
      name: tag.name,
      slug: tag.slug,
    })),
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  }
}

/** Maps a populated post detail while preserving its raw Markdown body. */
export function toPostDetailDto(post: PostDetailSource): PostDetailDto {
  return {
    ...toPostCardDto(post),
    content: post.content,
  }
}
