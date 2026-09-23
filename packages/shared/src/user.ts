import type { PostCardDto } from './post'

/** Public-safe user profile; never includes email or password data. */
export interface UserProfileDto {
  id: string
  name: string
  bio: string
  avatarUrl: string
}

export interface UserProfileResponse {
  user: UserProfileDto
  posts: PostCardDto[]
}
