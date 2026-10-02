import { randomUUID } from 'node:crypto'

import { pino, type LoggerOptions } from 'pino'
import { pinoHttp } from 'pino-http'

import { env } from '#env'

const isProduction = env.NODE_ENV === 'production'

// pino-http serializes the `cookie` request header and the `set-cookie` response
// header by default, and both carry the session JWT, so they are masked here
// along with the other sensitive fields.
const redact: LoggerOptions['redact'] = {
  paths: [
    'req.headers.cookie',
    'req.headers.authorization',
    'res.headers["set-cookie"]',
    'password',
  ],
  censor: '[REDACTED]',
}

// `pino-pretty` runs in-process as a destination stream instead of a pino
// `transport`. Pino transports execute in a worker thread whose entry file
// (`thread-stream/lib/worker.js`) is resolved relative to `__dirname` at
// runtime; that path does not exist in the bundled `build/` output, which is
// expected to run without `node_modules`.
async function createLogger() {
  if (isProduction) {
    return pino({ level: env.LOG_LEVEL, redact })
  }

  const { default: pinoPretty } = await import('pino-pretty')

  return pino(
    { level: env.LOG_LEVEL, redact },
    pinoPretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }),
  )
}

export const logger = await createLogger()

export const httpLogger = pinoHttp({
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
  autoLogging: { ignore: (req) => req.url === '/health' },
})
