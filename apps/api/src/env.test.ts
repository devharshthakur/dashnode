import { describe, expect, it } from 'vitest'

import { env } from '#env'

// `.env.test` is the only file a test run may read, so these assert on the
// values that file supplies rather than on a copy of them.
describe('env', () => {
  it('runs in the test environment', () => {
    expect(env.NODE_ENV).toBe('test')
  })

  it('takes its logging level from .env.test', () => {
    expect(env.LOG_LEVEL).toBe('silent')
  })

  it('satisfies the schema with a throwaway signing secret', () => {
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32)
  })

  // The regression guard: a developer's `.env` is never opened, so the keys
  // `.env.test` omits have to stay unset.
  it('never picks up a developer .env', () => {
    expect(env.HTTP_BASE_URL).toBeUndefined()
  })
})
