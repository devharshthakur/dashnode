import { pino, type Logger } from 'pino'

import { env } from '#env'

const isProduction = env.NODE_ENV === 'production'

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
async function createLogger(): Promise<Logger> {
  if (isProduction) {
    return pino({ level: env.LOG_LEVEL })
  }

  const { default: pinoPretty } = await import('pino-pretty')

  return pino(
    { level: env.LOG_LEVEL },
    pinoPretty({
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    }),
  )
}

export const logger = await createLogger()
