import { Router } from 'express'
import type { TagListResponse } from '@packages/shared'

import { listTags } from '#services/tag'

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
