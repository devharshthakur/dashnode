import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `src/env.ts` reads nothing from `node:fs` except this one function, so the
// mocked module is described by the single export the case steers.
type FsModule = Record<string, unknown> & {
  existsSync: (path: string) => boolean
}

// `src/env.ts` decides which file to read with `existsSync`. Reporting the file
// as absent keeps these cases on the schema itself: without the mock, a value
// `.env.test` or a developer's `.env` happens to define would be re-read into
// `process.env` by every import and the "absent" case could not be reached.
vi.mock('node:fs', async (importOriginal) => {
  const actual = (await importOriginal()) as FsModule

  return { ...actual, existsSync: () => false }
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

// `env.ts` runs its whole parse at import time, so each case resets the module
// registry and imports it again. A single static import can only be tested once.
async function importEnv() {
  const { env } = await import('#env')

  return env
}

beforeEach(() => {
  vi.resetModules()

  for (const key of KEYS) {
    vi.stubEnv(key, undefined)
  }

  vi.stubEnv('JWT_SECRET', SECRET)
  // The module reports every failure on `console` before exiting, and half of
  // these cases are meant to fail.
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('env defaults', () => {
  it('supplies every value the schema has a default for', async () => {
    const env = await importEnv()

    expect(env.NODE_ENV).toBe('development')
    expect(env.PORT).toBe(3001)
    expect(env.LOG_LEVEL).toBe('info')
    expect(env.MONGO_URI).toBe('mongodb://localhost:27017/hashnode')
    expect(env.CORS_ORIGIN).toBe('http://localhost:5173')
    expect(env.HTTP_TIMEOUT_MS).toBe(10_000)
  })

  it('leaves an optional variable unset', async () => {
    expect((await importEnv()).HTTP_BASE_URL).toBeUndefined()
  })
})

describe('env coercion', () => {
  it('coerces the numeric variables from strings', async () => {
    vi.stubEnv('PORT', '4321')
    vi.stubEnv('HTTP_TIMEOUT_MS', '2500')

    const env = await importEnv()

    expect(env.PORT).toBe(4321)
    expect(env.HTTP_TIMEOUT_MS).toBe(2500)
  })

  it.each([
    ['PORT', '0'],
    ['PORT', '-1'],
    ['HTTP_TIMEOUT_MS', '0'],
    ['HTTP_TIMEOUT_MS', 'soon'],
  ])('rejects %s=%s', async (key, value) => {
    const exit = stubExit()
    vi.stubEnv(key, value)

    await importEnv()

    expect(exit).toHaveBeenCalledWith(1)
  })
})

describe('env failures', () => {
  it('rejects a signing secret shorter than 32 characters', async () => {
    const exit = stubExit()
    const logged = console.error as unknown as ReturnType<typeof vi.fn>
    vi.stubEnv('JWT_SECRET', 'too-short')

    await importEnv()

    expect(exit).toHaveBeenCalledWith(1)
    expect(logged.mock.calls.flat().join('\n')).toContain('JWT_SECRET')
  })

  it('rejects an environment outside the enum', async () => {
    const exit = stubExit()
    vi.stubEnv('NODE_ENV', 'staging')

    await importEnv()

    expect(exit).toHaveBeenCalledWith(1)
  })

  it('rejects a log level outside the enum', async () => {
    const exit = stubExit()
    vi.stubEnv('LOG_LEVEL', 'chatty')

    await importEnv()

    expect(exit).toHaveBeenCalledWith(1)
  })

  // Without this, the first failing import would take the whole worker with it.
  it('prints the reason before exiting', async () => {
    stubExit()
    const logged = console.error as unknown as ReturnType<typeof vi.fn>
    vi.stubEnv('JWT_SECRET', 'too-short')

    await importEnv()

    expect(logged).toHaveBeenCalled()
  })
})

// A real `process.exit` would end the worker mid-suite, so every failing import
// stands on a stub that records the call and returns.
function stubExit() {
  return vi
    .spyOn(process, 'exit')
    .mockImplementation((() => undefined) as never)
}
