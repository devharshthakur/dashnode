import { describe, expect, it } from 'vitest'

import { env } from '#env'
import { testEnv } from '../vitest.config'

// A `.env` file next to the tests must never reach them: `loadEnvFile` fills in
// the keys the test run leaves unset, so without the `NODE_ENV === 'test'` guard
// in `src/env.ts` a developer's machine would decide the result.
describe('env', () => {
  it('uses the values the test runner installs', () => {
    expect(env.NODE_ENV).toBe(testEnv.NODE_ENV)
    expect(env.LOG_LEVEL).toBe(testEnv.LOG_LEVEL)
    expect(env.CORS_ORIGIN).toBe(testEnv.CORS_ORIGIN)
  })

  it('signs sessions with the test secret rather than a local one', () => {
    expect(env.JWT_SECRET).toBe(testEnv.JWT_SECRET)
  })

  it('does not pick up keys the test environment leaves unset', () => {
    expect(env.HTTP_BASE_URL).toBeUndefined()
  })
})
