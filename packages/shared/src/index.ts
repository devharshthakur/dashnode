/**
 * Wire contract shared by the API (`apps/api`) and the web app (`apps/web`).
 *
 * Types only: the API owns validation and persistence, the web app owns
 * rendering. Markdown is transported verbatim in `content`; neither side
 * parses it here.
 */

export type PostStatus = 'draft' | 'published'

export interface TagDto {
  id: string
  name: string
  slug: string
}

/** Public-safe author summary; never includes email or password data. */
export interface AuthorDto {
  id: string
  name: string
  avatarUrl: string
}

/** Public-safe user profile; never includes email or password data. */
export interface UserProfileDto {
  id: string
  name: string
  bio: string
  avatarUrl: string
}

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

/** Public feed response: newest-first published post cards. */
export interface PostListResponse {
  posts: PostCardDto[]
}

export interface UserProfileResponse {
  user: UserProfileDto
  posts: PostCardDto[]
}
