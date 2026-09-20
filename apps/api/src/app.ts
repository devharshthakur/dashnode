import cookieParser from 'cookie-parser'
import express from 'express'
import { pinoHttp } from 'pino-http'

import { logger } from '#config/logger'
import { errorHandler, notFoundHandler } from '#middlewares/error'
import { API_PREFIX, apiRouter } from '#routes/index'

export function createApp() {
  const app = express()

  app.use(pinoHttp({ logger }))
  app.use(express.json())
  // Parse the `Cookie` header into `req.cookies` (and signed cookies into
  // `req.signedCookies` when a secret is provided).
  app.use(cookieParser())

  app.use(API_PREFIX, apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
