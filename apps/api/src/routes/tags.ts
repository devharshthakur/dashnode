import { Router } from 'express'
import type { Request } from 'express'
import type { PostListResponse, TagListResponse } from '@packages/shared'

import { sendValidationError } from '#errors/route'
import { postPageQuerySchema } from '#schemas/post'
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
  const parsed = postPageQuerySchema.safeParse(req.query)

  if (!parsed.success) {
    sendValidationError(res, parsed.error)
    return
  }

  const result = await listPublishedPosts({ tag: req.params.slug }, parsed.data)
  const body: PostListResponse = {
    posts: result.posts.map(toPostCardDto),
    nextCursor: result.nextCursor,
  }

  res.status(200).json(body)
})
