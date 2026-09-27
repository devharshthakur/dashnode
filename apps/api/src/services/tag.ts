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
 * Every tag used by at least one published post, with the number of distinct
 * published posts that use it. Drafts are not counted, and a post that links
 * one tag twice still counts once.
 *
 * A tag no published post uses is left out of the directory, so a tag an author
 * coined on a draft — or one orphaned by retagging or deleting its only post —
 * cannot reveal itself to a visitor. The tag document itself is kept, so
 * publishing the draft or writing another post under the same name reuses the
 * same tag instead of creating a second one. The directory is derived from
 * published posts rather than from the tag collection precisely so that it
 * follows draft -> published and published -> draft transitions on its own.
 */
export async function listTags(): Promise<TagWithPostCountSource[]> {
  const publishedPostCounts = await Post.aggregate<{
    _id: Types.ObjectId
    postCount: number
  }>([
    { $match: { status: 'published' } },
    { $unwind: '$tags' },
    { $group: { _id: { postId: '$_id', tagId: '$tags' } } },
    { $group: { _id: '$_id.tagId', postCount: { $sum: 1 } } },
  ])

  if (publishedPostCounts.length === 0) {
    return []
  }

  const tags = await Tag.find({
    _id: { $in: publishedPostCounts.map(({ _id }) => _id) },
  })
    .sort({ name: 1 })
    .lean()
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
