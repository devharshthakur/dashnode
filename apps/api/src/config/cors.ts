import type { CorsOptions } from 'cors'

import { env } from '#env'

/**
 * Origins allowed to make browser requests to the API, parsed from the
 * comma-separated `CORS_ORIGIN` env var.
 */
export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0)

/**
 * CORS configuration for the API.
 *
 * Origins are explicitly whitelisted (required when credentials are
 * enabled), and credentials are allowed so cookies are sent on
 * cross-origin requests.
 */
export const corsOptions: CorsOptions = {
  origin: corsOrigins,
  credentials: true,
}
