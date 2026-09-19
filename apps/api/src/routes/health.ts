import { Router } from 'express'

import { getHealthStatus } from '#services/health'

export const healthRouter = Router()

healthRouter.get('/', (_req, res) => {
  res.json(getHealthStatus())
})
