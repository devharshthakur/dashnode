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
 * Vitest defaults `NODE_ENV` to `test` only when it is unset. A runner that
 * already exported another value keeps it, and the suite would then silently
 * load the wrong file — or none. Refuse that before anything else runs.
 */
export function rejectUnexpectedNodeEnv(
  runnerEnv = process.env.NODE_ENV,
): void {
  if (runnerEnv !== undefined && runnerEnv !== 'test') {
    throw new Error(
      `Refusing to run the test suite under NODE_ENV=${runnerEnv}. Vitest ` +
        'defaults NODE_ENV to test only when it is unset; unset it and rerun.',
    )
  }
}

/**
 * The runner selects the environment, never the file, so `.env.test` must not
 * declare `NODE_ENV` at all — not even `NODE_ENV=test` — or the file could
 * replace the value the runner already decided.
 */
export function rejectDeclaredNodeEnv(values: Record<string, string>): void {
  if (values.NODE_ENV !== undefined) {
    throw new Error(
      '.env.test must not declare NODE_ENV; the runner selects the ' +
        'environment, and the file is only read after that choice is made.',
    )
  }
}

/**
 * The environment `src/env.ts` will parse once the file is loaded. It mirrors
 * that module's precedence: a shell or CI variable already exported wins over
 * the file, and `NODE_ENV` is always `test` here (the runner default, already
 * checked above).
 */
export function effectiveTestEnv(
  values: Record<string, string>,
): Record<string, unknown> {
  const effective: Record<string, unknown> = { ...values }

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      effective[key] = value
    }
  }

  effective.NODE_ENV = process.env.NODE_ENV ?? 'test'

  return effective
}

/**
 * Validates what the workers will actually parse, not just the file: an invalid
 * value exported by the shell or CI has to fail here, before a worker starts,
 * rather than be discovered by `src/env.ts` inside a worker.
 */
export function validateEffectiveTestEnv(values: Record<string, string>): void {
  const parsed = envSchema.safeParse(effectiveTestEnv(values))

  if (!parsed.success) {
    throw new Error(
      `Invalid test environment:\n${z.prettifyError(parsed.error)}`,
    )
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
 * invalid `.env.test` — or an unexpected runner environment — aborts the run
 * before MongoDB starts or a worker executes.
 */
export function setup(): void {
  rejectUnexpectedNodeEnv()

  const values = loadTestEnv()

  rejectDeclaredNodeEnv(values)
  validateEffectiveTestEnv(values)
  applyTestEnv(values)
}
