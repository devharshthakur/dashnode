import { existsSync } from 'node:fs'

import { z } from 'zod'

if (existsSync('.env')) {
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
  HTTP_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  HTTP_BASE_URL: z.url().optional(),
})

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  console.error('Invalid environment variables:')
  console.error(z.prettifyError(parsedEnv.error))
  process.exit(1)
}

export const env = parsedEnv.data

export type Env = z.infer<typeof envSchema>
