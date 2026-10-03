import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { z } from 'zod'

import { envSchema } from '#schemas/env'

// The runner chooses the environment, never the file: Vitest defaults
// `NODE_ENV` to `test` only when it is unset, and `preview` sets
// `NODE_ENV=production`. `NODE_ENV` is therefore never read from a file,
// because deciding which file to load is what depends on it.
const envFileByName: Record<string, string | undefined> = {
  test: '.env.test',
  development: '.env',
  // Railway and Vercel inject the real production values, and `SETUP.md` keeps
  // them out of the repository. A local production run has none, so it reads the
  // same file; `loadEnvFile` below leaves an injected value alone.
  production: '.env',
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

const parsedEnv = envSchema.safeParse(process.env)

if (!parsedEnv.success) {
  // `console` because the logger is built from the env parsed here.
  console.error('Invalid environment variables:')
  console.error(z.prettifyError(parsedEnv.error))
  process.exit(1)
}

export const env = parsedEnv.data

export type { Env } from '#schemas/env'
