import { z } from 'zod'

/**
 * The one schema every environment passes through, production or test.
 *
 * It sits with the request schemas rather than in `src/env.ts`, so a caller
 * that only needs it — the Vitest pre-flight validating `.env.test` — can
 * import it without triggering `src/env.ts`'s file read and `process.exit`.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  MONGO_URI: z.string().min(1).default('mongodb://localhost:27017/hashnode'),
  CORS_ORIGIN: z.string().min(1).default('http://localhost:5173'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters long'),
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  HTTP_BASE_URL: z.url().optional(),
})

export type Env = z.infer<typeof envSchema>
