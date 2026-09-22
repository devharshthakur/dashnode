import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { API_PREFIX } from '#config/constants'
import { corsOptions } from '#config/cors'
import { httpLogger } from '#config/logger'
import { errorHandler, notFoundHandler } from '#middlewares/error'
import { apiRouter } from '#routes/index'

export function App() {
  const app = express()

  app.use(httpLogger)
  app.use(cors(corsOptions))
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())
  app.use(API_PREFIX, apiRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
