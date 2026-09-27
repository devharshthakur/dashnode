import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { z } from 'zod'

// The runner chooses the environment, never the file: Vitest sets
// `NODE_ENV=test`, and `preview` sets `NODE_ENV=production`. `NODE_ENV` is
// therefore never read from a file, because deciding which file to load is what
// depends on it.
const envFileByName: Record<string, string | undefined> = {
  test: '.env.test',
  development: '.env',
  // Railway and Vercel inject the real production values, and `SETUP.md` keeps
  // them out of the repository.
  production: undefined,
}

const envFile = envFileByName[process.env.NODE_ENV ?? 'development']

// Resolved from the module rather than `process.cwd()`, so a run started from
// the repository root reads the same file as one started from `apps/api`.
const envPath = envFile ? resolve(import.meta.dirname, '..', envFile) : null

if (envPath && existsSync(envPath)) {
  // `loadEnvFile` only fills in variables that are still unset, so a variable
  // set by the runner or the shell always wins over the file.
  process.loadEnvFile(envPath)
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
