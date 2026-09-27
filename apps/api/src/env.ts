import { existsSync } from 'node:fs'

import { z } from 'zod'

// `loadEnvFile` leaves variables that are already set alone, so the values
// `vitest.config.ts` installs survive a local `.env`. It does not, however, skip
// the keys the test run leaves unset, and those would make a result depend on
// which machine ran it. Tests take their environment from that config alone.
if (process.env.NODE_ENV !== 'test' && existsSync('.env')) {
  process.loadEnvFile()
}

const envSchema = z.object({
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

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  // `console` because the logger is built from the env parsed here.
  console.error('Invalid environment variables:')
  console.error(z.prettifyError(parsedEnv.error))
  process.exit(1)
}

export const env = parsedEnv.data

export type Env = z.infer<typeof envSchema>
