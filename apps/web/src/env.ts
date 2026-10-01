import { z } from 'zod'

import { envSchema } from '#/lib/schemas/env'

// Vite owns file loading: it reads `.env`, `.env.local`, `.env.[mode]`, and
// `.env.[mode].local`, keeps only `VITE_`-prefixed variables, and exposes the
// result on `import.meta.env`. There is no `process.loadEnvFile` step to mirror
// here, so this module only validates what Vite already assembled.
const parsedEnv = envSchema.safeParse(import.meta.env)

if (!parsedEnv.success) {
  // `console` because this runs before any application logger exists, and in a
  // browser where none may. Throwing, rather than exiting, is what both a
  // browser and an SSR worker can honor.
  console.error('Invalid environment variables:')
  console.error(z.prettifyError(parsedEnv.error))
  throw new Error('Invalid environment variables')
}

export const env = parsedEnv.data

export type { Env } from '#/lib/schemas/env'
