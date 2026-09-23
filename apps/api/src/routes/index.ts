import { Router } from 'express'
import { authRouter } from '#routes/auth'
import { healthRouter } from '#routes/health'
import { postsRouter } from '#routes/posts'
import { usersRouter } from '#routes/users'

export const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/health', healthRouter)
apiRouter.use('/posts', postsRouter)
apiRouter.use('/users', usersRouter)
