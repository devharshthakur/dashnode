import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'
import { describe, expect, it } from 'vitest'

import { env } from '#env'

// `src/env.ts` gives a variable already in the environment precedence over the
// file (`loadEnvFile` only fills in what is unset), so these assert against what
// `.env.test` declares rather than against copies of its values. A developer or
// CI runner that exports one of these keys is then covered rather than broken.
const envTestFile = parseEnv(
  readFileSync(fileURLToPath(new URL('../.env.test', import.meta.url)), 'utf8'),
) as Record<string, string>

/** What `env.ts` should hold for a key `.env.test` declares. */
function expected(key: string): string | undefined {
  return process.env[key] ?? envTestFile[key]
}

describe('env', () => {
  it('runs in the test environment', () => {
    expect(env.NODE_ENV).toBe('test')
  })

  it('takes its logging level from .env.test', () => {
    expect(envTestFile.LOG_LEVEL).toBeDefined()
    expect(env.LOG_LEVEL).toBe(expected('LOG_LEVEL'))
  })

  it('satisfies the schema with a throwaway signing secret', () => {
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32)
  })

  // The regression guard: a developer's `.env` is never opened, so the keys
  // `.env.test` omits have to stay unset.
  it('never picks up a developer .env', () => {
    expect(envTestFile.HTTP_BASE_URL).toBeUndefined()
    expect(env.HTTP_BASE_URL).toBe(expected('HTTP_BASE_URL'))
  })
})
