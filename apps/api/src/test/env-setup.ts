import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseEnv } from 'node:util'

import { z } from 'zod'

import { envSchema } from '#schemas/env'

/**
 * The environment file the suite runs against. It is committed, and resolved
 * from this module rather than `process.cwd()`, so a run started from the
 * repository root reads the same file as one started from `apps/api`.
 */
export const TEST_ENV_PATH = resolve(
  import.meta.dirname,
  '..',
  '..',
  '.env.test',
)

/**
 * Reads the file's own variables — not the defaults the schema would fill in,
 * and not whatever the surrounding environment exported. A missing file is an
 * error rather than a silent fall back to the runner's environment.
 */
export function loadTestEnv(path = TEST_ENV_PATH): Record<string, string> {
  if (!existsSync(path)) {
    throw new Error(
      `${path} is missing. It is committed so \`pnpm test\` works on a fresh ` +
        'clone; restore it with Git rather than exporting its variables by hand.',
    )
  }

  const parsed = parseEnv(readFileSync(path, 'utf8'))

  return Object.fromEntries(
    Object.entries(parsed).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  )
}

/**
 * Validates the file the way `src/env.ts` validates the environment built from
 * it. `NODE_ENV` is supplied because the file deliberately omits it — Vitest
 * sets it — and the schema's defaults cover the rest, so a key is required only
 * when it has no default, which today means `JWT_SECRET`.
 */
export function validateTestEnv(values: Record<string, string>): void {
  const parsed = envSchema.safeParse({ NODE_ENV: 'test', ...values })

  if (!parsed.success) {
    throw new Error(`.env.test is invalid:\n${z.prettifyError(parsed.error)}`)
  }
}

/**
 * Hands the file's values to the workers through the environment they inherit.
 * `??=` keeps the precedence `src/env.ts` gives a shell or CI value, and leaves
 * every key the file omits alone so it cannot be mistaken for a declared one.
 */
export function applyTestEnv(values: Record<string, string>): void {
  for (const [key, value] of Object.entries(values)) {
    process.env[key] ??= value
  }
}

/**
 * The Vitest global setup. It is listed before the replica set so a missing or
 * invalid `.env.test` aborts the run before a worker starts or a test executes.
 * It logs the file it reads and the variables it validated, so a run shows
 * where the suite's environment came from.
 */
export function setup(): void {
  console.log(`[env] loading ${TEST_ENV_PATH}`)

  const values = loadTestEnv()

  validateTestEnv(values)
  applyTestEnv(values)

  console.log(
    `[env] .env.test validated against the env schema: ${Object.keys(values).sort().join(', ')}`,
  )
}
