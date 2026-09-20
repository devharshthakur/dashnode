import { pino } from 'pino'

import { env } from '#env'

const isProduction = env.NODE_ENV === 'production'

/**
 * Shared Pino logger for the API.
 *
 * Uses the level from validated env and pretty-prints outside production
 * for readable local development output.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  ...(isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      }),
})
