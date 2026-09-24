import { Router } from 'express'
import type { Request } from 'express'
import type { PostListResponse, TagListResponse } from '@packages/shared'

import { listPublishedPosts } from '#services/post'
import { listTags } from '#services/tag'
import { toPostCardDto } from '#utils/post'

export const tagsRouter = Router()

tagsRouter.get('/', async (_req, res) => {
  const tags = await listTags()
  const body: TagListResponse = {
    tags: tags.map((tag) => ({
      id: String(tag._id),
      name: tag.name,
      slug: tag.slug,
      postCount: tag.postCount,
    })),
  }

  res.status(200).json(body)
})

tagsRouter.get('/:slug/posts', async (req: Request<{ slug: string }>, res) => {
  const posts = await listPublishedPosts({ tag: req.params.slug })
  const body: PostListResponse = { posts: posts.map(toPostCardDto) }

  res.status(200).json(body)
})
