import type { AuthorDto } from './author'
import type { TagDto } from './tag'

export type PostStatus = 'draft' | 'published'

/**
 * Canonical post resource returned by the write endpoints. Relations are
 * ObjectId strings; the read endpoints return the populated projections below.
 */
export interface PostDto {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  coverImage: string
  status: PostStatus
  author: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

/** Feed/dashboard projection: card fields with populated author and tags. */
export interface PostCardDto {
  id: string
  title: string
  slug: string
  excerpt: string
  coverImage: string
  status: PostStatus
  author: AuthorDto
  tags: TagDto[]
  createdAt: string
  updatedAt: string
}

/** Post detail projection: a card plus the full raw Markdown body. */
export interface PostDetailDto extends PostCardDto {
  content: string
}

export interface CreatePostInput {
  title: string
  content: string
  tags: string[]
  coverImage?: string
  excerpt?: string
  /** Defaults to `draft` server-side when omitted. */
  status?: PostStatus
}

export type UpdatePostInput = Partial<CreatePostInput>

export interface PostResponse {
  post: PostDto
}

/** Post list response containing populated post cards. */
export interface PostListResponse {
  posts: PostCardDto[]
}

/** Post detail response with the full raw Markdown body. */
export interface PostDetailResponse {
  post: PostDetailDto
}
