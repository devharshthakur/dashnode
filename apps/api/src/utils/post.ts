import type { PostDto } from '@packages/shared'
import type { HydratedDocument } from 'mongoose'

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
