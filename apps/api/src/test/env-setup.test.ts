import { afterEach, describe, expect, it, vi } from 'vitest'

import { envSchema } from '#schemas/env'
import {
  applyTestEnv,
  loadTestEnv,
  setup,
  TEST_ENV_PATH,
  validateTestEnv,
} from '#test/env-setup'

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

describe('validateTestEnv', () => {
  // `.env.test` omits NODE_ENV, so this passes only because the pre-flight
  // supplies the value Vitest sets.
  it('accepts the committed file', () => {
    expect(() => validateTestEnv(loadTestEnv())).not.toThrow()
  })

  it('rejects a required key the file omits', () => {
    expect(() => validateTestEnv({ LOG_LEVEL: 'silent' })).toThrow('JWT_SECRET')
  })

  it('rejects a value that fails validation', () => {
    expect(() =>
      validateTestEnv({ JWT_SECRET: 'too-short', LOG_LEVEL: 'silent' }),
    ).toThrow('JWT_SECRET')
  })

  it('rejects a log level outside the enum', () => {
    expect(() =>
      validateTestEnv({ JWT_SECRET: 'a'.repeat(32), LOG_LEVEL: 'chatty' }),
    ).toThrow('LOG_LEVEL')
  })
})

describe('applyTestEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

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
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  // The run's output has to say what it loaded and what it validated, so a
  // misconfigured checkout is diagnosable without instrumenting it by hand.
  it('logs the file it loads and the variables it validated', () => {
    const logged = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.stubEnv('LOG_LEVEL', undefined)
    vi.stubEnv('JWT_SECRET', undefined)

    setup()

    const output = logged.mock.calls.flat().join('\n')

    expect(output).toContain('.env.test')
    expect(output).toContain('LOG_LEVEL')
    expect(output).toContain('JWT_SECRET')
  })
})
