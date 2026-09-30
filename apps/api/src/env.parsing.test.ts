import { describe, expect, it } from 'vitest'

import { envSchema } from '#schemas/env'

const SECRET = 'a'.repeat(32)

// The schema itself, exercised directly: defaults, coercion, and the rejection
// matrix. `src/env.ts` applies this to `process.env`, and the Vitest pre-flight
// applies it to the effective test environment; both are covered by their own
// tests rather than restated here.
describe('envSchema', () => {
  it('supplies every value the schema has a default for', () => {
    expect(envSchema.parse({ JWT_SECRET: SECRET })).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3001,
      LOG_LEVEL: 'info',
      MONGO_URI: 'mongodb://localhost:27017/hashnode',
      CORS_ORIGIN: 'http://localhost:5173',
      HTTP_TIMEOUT_MS: 10_000,
    })
  })

  it('leaves an optional variable unset', () => {
    expect(
      envSchema.parse({ JWT_SECRET: SECRET }).HTTP_BASE_URL,
    ).toBeUndefined()
  })

  it('coerces the numeric variables from strings', () => {
    const env = envSchema.parse({
      JWT_SECRET: SECRET,
      PORT: '4321',
      HTTP_TIMEOUT_MS: '2500',
    })

    expect(env.PORT).toBe(4321)
    expect(env.HTTP_TIMEOUT_MS).toBe(2500)
  })

  it('rejects a signing secret shorter than 32 characters', () => {
    expect(envSchema.safeParse({ JWT_SECRET: 'too-short' }).success).toBe(false)
  })

  it.each([
    ['PORT', '0'],
    ['PORT', '-1'],
    ['HTTP_TIMEOUT_MS', '0'],
    ['HTTP_TIMEOUT_MS', 'soon'],
  ])('rejects %s=%s', (key, value) => {
    const parsed = envSchema.safeParse({ JWT_SECRET: SECRET, [key]: value })

    expect(parsed.success).toBe(false)
  })

  it('rejects an environment outside the enum', () => {
    const parsed = envSchema.safeParse({
      JWT_SECRET: SECRET,
      NODE_ENV: 'staging',
    })

    expect(parsed.success).toBe(false)
  })

  it('rejects a log level outside the enum', () => {
    const parsed = envSchema.safeParse({
      JWT_SECRET: SECRET,
      LOG_LEVEL: 'chatty',
    })

    expect(parsed.success).toBe(false)
  })
})
