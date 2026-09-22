import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'

import {
  InvalidPostIdError,
  PostForbiddenError,
  PostNotFoundError,
} from '#errors/post'
import { requireAuth } from '#middlewares/auth'
import { createPostBodySchema, updatePostBodySchema } from '#schemas/post'
import { createPost, deletePost, updatePost } from '#services/post'
import { toPostDto } from '#utils/post'
import { sendValidationError } from '#errors/route'

export const postsRouter = Router()

function handlePostError(
  res: Response,
  next: NextFunction,
  error: unknown,
): void {
  if (error instanceof InvalidPostIdError) {
    res.status(400).json({ error: error.message })
    return
  }

  if (error instanceof PostNotFoundError) {
    res.status(404).json({ error: error.message })
    return
  }

  if (error instanceof PostForbiddenError) {
    res.status(403).json({ error: error.message })
    return
  }

  next(error)
}

postsRouter.post('/', requireAuth, async (req, res) => {
  const parsed = createPostBodySchema.safeParse(req.body)

  if (!parsed.success) {
    sendValidationError(res, parsed.error)
    return
  }

  const post = await createPost(req.user!.id, parsed.data)

  res.status(201).json({ post: toPostDto(post) })
})

postsRouter.put(
  '/:id',
  requireAuth,
  async (req: Request<{ id: string }>, res, next) => {
    const parsed = updatePostBodySchema.safeParse(req.body)

    if (!parsed.success) {
      sendValidationError(res, parsed.error)
      return
    }

    try {
      const post = await updatePost(req.params.id, req.user!.id, parsed.data)

      res.status(200).json({ post: toPostDto(post) })
    } catch (error) {
      handlePostError(res, next, error)
    }
  },
)

postsRouter.delete(
  '/:id',
  requireAuth,
  async (req: Request<{ id: string }>, res, next) => {
    try {
      await deletePost(req.params.id, req.user!.id)

      res.status(200).json({ message: 'Post deleted' })
    } catch (error) {
      handlePostError(res, next, error)
    }
  },
)
