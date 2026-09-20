import { Router } from 'express'
import { healthRouter } from './health'

export const API_PREFIX = '/api'

export const apiRouter = Router()

apiRouter.use('/health', healthRouter)
