import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { pinoHttp } from 'pino-http'
import { corsOptions } from '#config/cors'
import { logger } from '#config/logger'
import { errorHandler, notFoundHandler } from '#middlewares/error'
import { API_PREFIX, apiRouter } from '#routes/index'

export function createApp() {
  const app = express()

  app.use(pinoHttp({ logger }))
  app.use(cors(corsOptions))
  app.use(express.json())
  app.use(cookieParser())
  app.use(API_PREFIX, apiRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
