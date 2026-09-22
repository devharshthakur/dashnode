import { randomUUID } from 'node:crypto'

import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { pinoHttp } from 'pino-http'
import { corsOptions } from '#config/cors'
import { logger } from '#config/logger'
import { errorHandler, notFoundHandler } from '#middlewares/error'
import { API_PREFIX, apiRouter } from '#routes/index'

export function App() {
  const app = express()

  app.use(
    pinoHttp({
      logger,
      // Reuse an inbound request id so traces correlate across services.
      genReqId: (req, res) => {
        const existing = req.headers['x-request-id']

        if (typeof existing === 'string' && existing.length > 0) {
          return existing
        }

        const id = randomUUID()
        res.setHeader('X-Request-Id', id)
        return id
      },
      // Frequently polled health checks add log noise without diagnostic value.
      autoLogging: { ignore: (req) => req.url === `${API_PREFIX}/health` },
    }),
  )
  app.use(cors(corsOptions))
  app.use(express.json())
  app.use(cookieParser())
  app.use(API_PREFIX, apiRouter)
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
