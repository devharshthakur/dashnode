import type { Types } from 'mongoose'

import { Post } from '#models/post'
import { Tag } from '#models/tag'

export interface TagWithPostCountSource {
  _id: Types.ObjectId
  name: string
  slug: string
  postCount: number
}

/**
 * Every tag, with the number of distinct published posts that use it. Drafts
 * are not counted, and a post that links one tag twice still counts once.
 */
export async function listTags(): Promise<TagWithPostCountSource[]> {
  const [tags, publishedPostCounts] = await Promise.all([
    Tag.find().sort({ name: 1 }).lean(),
    Post.aggregate<{ _id: Types.ObjectId; postCount: number }>([
      { $match: { status: 'published' } },
      { $unwind: '$tags' },
      { $group: { _id: { postId: '$_id', tagId: '$tags' } } },
      { $group: { _id: '$_id.tagId', postCount: { $sum: 1 } } },
    ]),
  ])
  const postCountsByTagId = new Map(
    publishedPostCounts.map(({ _id, postCount }) => [String(_id), postCount]),
  )

  return tags.map((tag) => ({
    _id: tag._id,
    name: tag.name,
    slug: tag.slug,
    postCount: postCountsByTagId.get(String(tag._id)) ?? 0,
  }))
}
