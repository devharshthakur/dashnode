import { Router } from 'express'
import type { Request, Response, NextFunction } from 'express'
import type { UserProfileResponse } from '@packages/shared'

import { logger } from '#config/logger'
import { InvalidUserIdError, UserNotFoundError } from '#errors/user'
import { requireAuth } from '#middlewares/auth'
import { updateUserProfileBodySchema } from '#schemas/user'
import { updateUserProfile } from '#services/auth'
import { getPublicUserProfile } from '#services/user'
import { sendValidationError } from '#errors/route'
import { toPostCardDto } from '#utils/post'

export const usersRouter = Router()

usersRouter.put('/me', requireAuth, async (req, res) => {
  const parsed = updateUserProfileBodySchema.safeParse(req.body)

  if (!parsed.success) {
    sendValidationError(res, parsed.error)
    return
  }

  const user = await updateUserProfile(req.user!.id, parsed.data)

  if (!user) {
    res.status(404).json({ error: 'User not found' })
    return
  }

  res.status(200).json({ user })
})

usersRouter.get(
  '/:id',
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const profile = await getPublicUserProfile(req.params.id)
      const body: UserProfileResponse = {
        user: profile.user,
        posts: profile.posts.map(toPostCardDto),
      }

      logger.info(
        { userId: profile.user.id, postCount: body.posts.length },
        'Public user profile retrieved',
      )
      res.status(200).json(body)
    } catch (error) {
      if (error instanceof InvalidUserIdError) {
        res.status(400).json({ error: error.message })
        return
      }

      if (error instanceof UserNotFoundError) {
        res.status(404).json({ error: error.message })
        return
      }

      next(error)
    }
  },
)
