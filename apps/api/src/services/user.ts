import { isValidObjectId } from 'mongoose'
import type { UserProfileDto } from '@packages/shared'

import { InvalidUserIdError, UserNotFoundError } from '#errors/user'
import { User } from '#models/user'
import { listPublishedPosts } from '#services/post'
import type { PostCardSource, PostPageQuery } from '#utils/post'

export interface PublicUserProfile {
  user: UserProfileDto
  posts: PostCardSource[]
  nextCursor: string | null
}

// The profile is a projection, so the email and the password hash never load.
export async function getPublicUserProfile(
  userId: string,
  page: PostPageQuery,
): Promise<PublicUserProfile> {
  if (!isValidObjectId(userId)) {
    throw new InvalidUserIdError()
  }

  const user = await User.findById(userId).select('name bio avatarUrl').lean()

  if (!user) {
    throw new UserNotFoundError()
  }

  const posts = await listPublishedPosts({ author: userId }, page)

  return {
    user: {
      id: String(user._id),
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
    },
    posts: posts.posts,
    nextCursor: posts.nextCursor,
  }
}
