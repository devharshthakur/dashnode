import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { basename } from 'node:path'

// `src/env.ts` decides which file to load with `existsSync` and loads it with
// `process.loadEnvFile`, so both are steered here. A real `.env` never exists
// in a fresh checkout, and a developer's `.env` must not influence the suite,
// so `existsSync` reports files absent unless a case asks for one.
const { existsSync } = vi.hoisted(() => ({
  existsSync: vi.fn(() => false),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()

  return { ...actual, existsSync }
})

const SECRET = 'a'.repeat(32)
const KEYS = [
  'NODE_ENV',
  'PORT',
  'LOG_LEVEL',
  'MONGO_URI',
  'CORS_ORIGIN',
  'JWT_SECRET',
  'HTTP_TIMEOUT_MS',
  'HTTP_BASE_URL',
]

// `src/env.ts` runs its whole parse at import time, so each case resets the
// module registry and imports it again under its own environment.
async function importEnv() {
  return (await import('#env')).env
}

let loadEnvFile: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.resetModules()

  for (const key of KEYS) {
    vi.stubEnv(key, undefined)
  }
  vi.stubEnv('JWT_SECRET', SECRET)

  existsSync.mockReset().mockReturnValue(false)
  loadEnvFile = vi.spyOn(process, 'loadEnvFile').mockImplementation(() => {})

  // The failure case prints its reason before exiting.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('env file selection', () => {
  it.each([
    ['with no NODE_ENV set', undefined],
    ['with NODE_ENV=development', 'development'],
    // A local production run (`pnpm preview`) has no injected values, so it reads
    // the same file; `loadEnvFile` leaves anything a platform already set alone.
    ['with NODE_ENV=production', 'production'],
  ])('loads `.env` %s', async (_case, nodeEnv) => {
    if (nodeEnv !== undefined) {
      vi.stubEnv('NODE_ENV', nodeEnv)
    }
    existsSync.mockReturnValue(true)

    await importEnv()

    expect(loadEnvFile).toHaveBeenCalledTimes(1)
    expect(basename(loadEnvFile.mock.calls[0]?.[0] ?? '')).toBe('.env')
  })

  it('loads `.env.test` with NODE_ENV=test', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    existsSync.mockReturnValue(true)

    await importEnv()

    expect(loadEnvFile).toHaveBeenCalledTimes(1)
    expect(basename(loadEnvFile.mock.calls[0]?.[0] ?? '')).toBe('.env.test')
  })

  it('loads no file when the resolved one is absent', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const env = await importEnv()

    expect(loadEnvFile).not.toHaveBeenCalled()
    expect(env.NODE_ENV).toBe('production')
  })
})

describe('env precedence', () => {
  // `process.loadEnvFile` only fills variables the shell left unset, so a file
  // declaring LOG_LEVEL cannot overwrite one the runner already exported.
  it('keeps a shell value over the file', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('LOG_LEVEL', 'error')
    existsSync.mockReturnValue(true)
    loadEnvFile.mockImplementation(() => {
      process.env.LOG_LEVEL ??= 'debug'
    })

    const env = await importEnv()

    expect(env.LOG_LEVEL).toBe('error')
  })

  it('lets the file fill a key the shell left unset', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    existsSync.mockReturnValue(true)
    loadEnvFile.mockImplementation(() => {
      process.env.LOG_LEVEL ??= 'debug'
    })

    const env = await importEnv()

    expect(env.LOG_LEVEL).toBe('debug')
  })
})

describe('env failures', () => {
  // A real `process.exit` would end the worker mid-suite, so the failure is
  // recorded against a stub instead.
  it('exits when the parsed environment is invalid', async () => {
    const exit = vi
      .spyOn(process, 'exit')
      .mockImplementation((() => undefined) as never)
    vi.stubEnv('JWT_SECRET', 'too-short')

    await importEnv()

    expect(exit).toHaveBeenCalledWith(1)
  })
})
