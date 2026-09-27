import type { CorsOptions } from 'cors'

import { env } from '#env'

// Origins allowed to make browser requests to the API, parsed from the
// comma-separated `CORS_ORIGIN` env var.
export const corsOrigins = env.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0)

// Origins are whitelisted explicitly because that is what enabling credentials
// requires, and credentials are on so the session cookie rides along on those
// cross-origin requests.
export const corsOptions: CorsOptions = {
  origin: corsOrigins,
  credentials: true,
}
