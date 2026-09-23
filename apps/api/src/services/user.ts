import { isValidObjectId } from 'mongoose'
import type { UserProfileDto } from '@packages/shared'

import { InvalidUserIdError, UserNotFoundError } from '#errors/user'
import { Post } from '#models/post'
import { User } from '#models/user'
import {
  type PopulatedAuthor,
  type PopulatedTag,
  type PostCardSource,
} from '#utils/post'

export interface PublicUserProfile {
  user: UserProfileDto
  posts: PostCardSource[]
}

/** Loads a public user profile and only that author's published posts. */
export async function getPublicUserProfile(
  userId: string,
): Promise<PublicUserProfile> {
  if (!isValidObjectId(userId)) {
    throw new InvalidUserIdError()
  }

  const user = await User.findById(userId).select('name bio avatarUrl').lean()

  if (!user) {
    throw new UserNotFoundError()
  }

  const posts = await Post.find({ author: userId, status: 'published' })
    .sort({ createdAt: -1 })
    .populate<{ author: PopulatedAuthor }>('author', 'name avatarUrl')
    .populate<{ tags: PopulatedTag[] }>('tags', 'name slug')
    .lean()

  return {
    user: {
      id: String(user._id),
      name: user.name,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
    },
    posts,
  }
}
