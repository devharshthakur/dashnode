import { afterEach, describe, expect, it, vi } from 'vitest'

import { envSchema } from '#schemas/env'
import {
  applyTestEnv,
  effectiveTestEnv,
  loadTestEnv,
  rejectDeclaredNodeEnv,
  rejectUnexpectedNodeEnv,
  setup,
  TEST_ENV_PATH,
  validateEffectiveTestEnv,
} from '#test/env-setup'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('loadTestEnv', () => {
  it('reads the committed file', () => {
    const values = loadTestEnv()

    expect(values.LOG_LEVEL).toBeDefined()
    expect(values.JWT_SECRET).toBeDefined()
  })

  it('rejects a missing file instead of falling back to the shell', () => {
    expect(() => loadTestEnv(`${TEST_ENV_PATH}.missing`)).toThrow(/is missing/)
  })
})

describe('rejectUnexpectedNodeEnv', () => {
  it('accepts the test environment and an unset one', () => {
    expect(() => rejectUnexpectedNodeEnv('test')).not.toThrow()
    expect(() => rejectUnexpectedNodeEnv(undefined)).not.toThrow()
  })

  it('rejects any other runner environment', () => {
    expect(() => rejectUnexpectedNodeEnv('production')).toThrow(
      /NODE_ENV=production/,
    )
  })
})

describe('rejectDeclaredNodeEnv', () => {
  it('accepts a file that omits NODE_ENV', () => {
    expect(() => rejectDeclaredNodeEnv({ LOG_LEVEL: 'silent' })).not.toThrow()
  })

  // Even `NODE_ENV=test` is refused: the file is only read after the runner has
  // already selected the environment, so the file must not select or replace it.
  it('rejects a file that declares NODE_ENV', () => {
    expect(() =>
      rejectDeclaredNodeEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent' }),
    ).toThrow(/NODE_ENV/)
  })
})

describe('effectiveTestEnv', () => {
  it('gives a shell value precedence over the file', () => {
    vi.stubEnv('LOG_LEVEL', 'error')

    expect(effectiveTestEnv({ LOG_LEVEL: 'debug' }).LOG_LEVEL).toBe('error')
  })

  it('treats an unset NODE_ENV as test', () => {
    vi.stubEnv('NODE_ENV', undefined)

    expect(effectiveTestEnv({}).NODE_ENV).toBe('test')
  })
})

describe('validateEffectiveTestEnv', () => {
  it('accepts the committed file', () => {
    expect(() => validateEffectiveTestEnv(loadTestEnv())).not.toThrow()
  })

  it('rejects a file value that fails validation', () => {
    // Unset the shell value the real pre-flight already applied, so the bad
    // file value is the one the effective environment actually parses.
    vi.stubEnv('JWT_SECRET', undefined)

    expect(() => validateEffectiveTestEnv({ JWT_SECRET: 'too-short' })).toThrow(
      /JWT_SECRET/,
    )
  })

  // The pre-flight gate, not a worker, has to catch a bad value the shell or CI
  // exported over an otherwise valid file.
  it('rejects an invalid shell override despite a valid file', () => {
    vi.stubEnv('LOG_LEVEL', 'chatty')

    expect(() => validateEffectiveTestEnv(loadTestEnv())).toThrow(/LOG_LEVEL/)
  })
})

describe('applyTestEnv', () => {
  it('keeps a value the runner already exported', () => {
    vi.stubEnv('TEST_ENV_PREFLIGHT_PROBE', 'from-the-shell')

    applyTestEnv({ TEST_ENV_PREFLIGHT_PROBE: 'from-the-file' })

    expect(process.env.TEST_ENV_PREFLIGHT_PROBE).toBe('from-the-shell')
  })

  it('sets a value the runner left unset', () => {
    vi.stubEnv('TEST_ENV_PREFLIGHT_PROBE', undefined)

    applyTestEnv({ TEST_ENV_PREFLIGHT_PROBE: 'from-the-file' })

    expect(process.env.TEST_ENV_PREFLIGHT_PROBE).toBe('from-the-file')
  })
})

describe('the committed .env.test', () => {
  // The schema strips unknown keys, so a typo in a variable name would go
  // unvalidated unless the file is held to the schema's own keys.
  it('declares only keys the schema knows', () => {
    const known = Object.keys(envSchema.shape)

    for (const key of Object.keys(loadTestEnv())) {
      expect(known).toContain(key)
    }
  })
})

describe('setup', () => {
  it('validates and applies the committed file', () => {
    vi.stubEnv('JWT_SECRET', undefined)

    setup()

    expect(process.env.JWT_SECRET).toBe(loadTestEnv().JWT_SECRET)
    expect(process.env.LOG_LEVEL).toBe(loadTestEnv().LOG_LEVEL)
  })

  it('rejects an unexpected runner environment before applying anything', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', undefined)

    expect(() => setup()).toThrow(/NODE_ENV=production/)
    expect(process.env.JWT_SECRET).toBeUndefined()
  })

  // Validation runs before `applyTestEnv`, so a failing gate must not leak half
  // the file into the workers.
  it('does not partially apply the file when validation fails', () => {
    vi.stubEnv('LOG_LEVEL', 'chatty')
    vi.stubEnv('JWT_SECRET', undefined)

    expect(() => setup()).toThrow(/LOG_LEVEL/)
    expect(process.env.JWT_SECRET).toBeUndefined()
  })
})
