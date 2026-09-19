import express from 'express'
import { pinoHttp } from 'pino-http'

import { logger } from '#lib/logger'
import { errorHandler, notFoundHandler } from '#middlewares/error'
import { apiRouter } from '#routes/index'

export function createApp() {
  const app = express()

  app.use(pinoHttp({ logger }))
  app.use(express.json())

  app.use('/api', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
