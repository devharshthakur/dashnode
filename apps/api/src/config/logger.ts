import { pino, type LoggerOptions } from 'pino'

import { env } from '#env'

const isProduction = env.NODE_ENV === 'production'

/**
 * Sensitive fields masked from every log line. pino-http serializes the
 * `cookie` request header and the `set-cookie` response header by default,
 * both of which carry the session JWT.
 */
const redact: LoggerOptions['redact'] = {
  paths: [
    'req.headers.cookie',
    'req.headers.authorization',
    'res.headers["set-cookie"]',
    'password',
  ],
  censor: '[REDACTED]',
}

/**
 * Shared Pino logger for the API.
 *
 * Emits plain JSON in production so log collectors can parse it, and
 * pretty-printed output otherwise for local readability.
 *
 * `pino-pretty` runs in-process as a destination stream instead of a pino
 * `transport`. Pino transports execute in a worker thread whose entry file
 * (`thread-stream/lib/worker.js`) is resolved relative to `__dirname` at
 * runtime; that path does not exist in the bundled `build/` output, which is
 * expected to run without `node_modules`.
 */
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
