import { Router } from 'express'
import { authRouter } from '#routes/auth'
import { healthRouter } from '#routes/health'
import { postsRouter } from '#routes/posts'

export const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/health', healthRouter)
apiRouter.use('/posts', postsRouter)
