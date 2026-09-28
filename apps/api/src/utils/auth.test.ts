import { afterEach, describe, expect, it, vi } from 'vitest'

import { SignJWT } from 'jose'
import type { CookieOptions, Response } from 'express'

import { env } from '#env'
import {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  setAuthCookie,
  signSessionToken,
  verifySessionToken,
} from '#utils/auth'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const USER_ID = '65f1c0de5a1e2b3c4d5e6f70'

// The module under test signs with this key, so a token meant to reach it has
// to be signed with the same one. A different key is a separate case below.
const secret = new TextEncoder().encode(env.JWT_SECRET)
const otherSecret = new TextEncoder().encode('a'.repeat(32))

async function signWith(
  claims: { subject?: string; jti?: string; expiresIn?: string },
  key = secret,
): Promise<string> {
  const builder = new SignJWT().setProtectedHeader({ alg: 'HS256' })

  if (claims.subject !== undefined) {
    builder.setSubject(claims.subject)
  }

  if (claims.jti !== undefined) {
    builder.setJti(claims.jti)
  }

  if (claims.expiresIn !== undefined) {
    builder.setExpirationTime(claims.expiresIn)
  }

  return builder.sign(key)
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('signSessionToken', () => {
  it('produces a token that verifies with the user id as its subject', async () => {
    const session = await verifySessionToken(await signSessionToken(USER_ID))

    expect(session.userId).toBe(USER_ID)
  })

  // `setIssuedAt` records whole seconds, so the expiry lands up to a second
  // short of exactly seven days from the moment the token was asked for.
  it('expires seven days out', async () => {
    const before = Date.now()
    const session = await verifySessionToken(await signSessionToken(USER_ID))

    expect(session.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + SESSION_TTL_MS - 1000,
    )
    expect(session.expiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + SESSION_TTL_MS,
    )
  })

  // The revocation key is the `jti`, so a shared one would let one logout kill
  // every session the user has open.
  it('gives every token its own id', async () => {
    const first = await verifySessionToken(await signSessionToken(USER_ID))
    const second = await verifySessionToken(await signSessionToken(USER_ID))

    expect(first.jti).not.toBe(second.jti)
  })
})

describe('verifySessionToken', () => {
  it('throws for a value that is not a token', async () => {
    await expect(verifySessionToken('not-a-token')).rejects.toThrow()
    await expect(verifySessionToken('')).rejects.toThrow()
  })

  it('throws for a token signed with a different secret', async () => {
    const token = await signWith(
      { subject: USER_ID, jti: 'a-jti', expiresIn: '1h' },
      otherSecret,
    )

    await expect(verifySessionToken(token)).rejects.toThrow()
  })

  it('throws for a token whose signature was altered', async () => {
    const [header, payload, signature] = (
      await signSessionToken(USER_ID)
    ).split('.')
    const bytes = Buffer.from(signature, 'base64url')
    bytes[0] ^= 0xff

    await expect(
      verifySessionToken(
        [header, payload, bytes.toString('base64url')].join('.'),
      ),
    ).rejects.toThrow()
  })

  it('throws for an expired token', async () => {
    const token = await signWith({
      subject: USER_ID,
      jti: 'a-jti',
      expiresIn: '-10s',
    })

    await expect(verifySessionToken(token)).rejects.toThrow()
  })

  // Only the subject is reachable through `signSessionToken`, so the other two
  // need tokens built by hand.
  it('throws a specific message when the subject is missing', async () => {
    const token = await signWith({ jti: 'a-jti', expiresIn: '1h' })

    await expect(verifySessionToken(token)).rejects.toThrow(
      'Session token is missing a subject',
    )
  })

  it('throws a specific message when the token id is missing', async () => {
    const token = await signWith({ subject: USER_ID, expiresIn: '1h' })

    await expect(verifySessionToken(token)).rejects.toThrow(
      'Session token is missing an id',
    )
  })

  it('throws a specific message when the expiry is missing', async () => {
    const token = await signWith({ subject: USER_ID, jti: 'a-jti' })

    await expect(verifySessionToken(token)).rejects.toThrow(
      'Session token is missing an expiration',
    )
  })
})

// `requireAuth` and the logout route read the cookie under this name.
describe('AUTH_COOKIE_NAME', () => {
  it('is token', () => {
    expect(AUTH_COOKIE_NAME).toBe('token')
  })
})

interface CookieCall {
  name: string
  value?: string
  options?: CookieOptions
}

/** Records the cookie calls a route would make, without an HTTP layer. */
function fakeResponse() {
  const set: CookieCall[] = []
  const cleared: CookieCall[] = []

  const res = {
    cookie(name: string, value: string, options?: CookieOptions) {
      set.push({ name, value, options })

      return res
    },
    clearCookie(name: string, options?: CookieOptions) {
      cleared.push({ name, options })

      return res
    },
  } as unknown as Response

  return { res, set, cleared }
}

describe('setAuthCookie', () => {
  it('stores the token where JavaScript cannot read it', () => {
    const { res, set } = fakeResponse()

    setAuthCookie(res, 'a-token')

    expect(set).toHaveLength(1)
    expect(set[0]?.name).toBe(AUTH_COOKIE_NAME)
    expect(set[0]?.value).toBe('a-token')
    expect(set[0]?.options?.httpOnly).toBe(true)
    expect(set[0]?.options?.path).toBe('/')
  })

  it('keeps seven days of lifetime', () => {
    const { res, set } = fakeResponse()

    setAuthCookie(res, 'a-token')

    expect(set[0]?.options?.maxAge).toBe(SESSION_TTL_MS)
  })

  it('stays Lax and insecure outside production', () => {
    const { res, set } = fakeResponse()

    setAuthCookie(res, 'a-token')

    expect(set[0]?.options?.secure).toBe(false)
    expect(set[0]?.options?.sameSite).toBe('lax')
  })

  it('needs an explicit secure flag in production, where the web app is cross-origin', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', env.JWT_SECRET)
    vi.resetModules()

    const { res, set } = fakeResponse()
    const production = await import('#utils/auth')

    production.setAuthCookie(res, 'a-token')

    expect(set[0]?.options?.secure).toBe(true)
    expect(set[0]?.options?.sameSite).toBe('none')
  })
})

describe('clearAuthCookie', () => {
  // A mismatch here makes the browser treat the cleared cookie as a different
  // one and keep sending the original. It is invisible in a response-body
  // assertion and only shows up in a browser.
  it('agrees with setAuthCookie on every option except maxAge', () => {
    const set = fakeResponse()
    const cleared = fakeResponse()

    setAuthCookie(set.res, 'a-token')
    clearAuthCookie(cleared.res)

    const { maxAge: _maxAge, ...setOptions } = set.set[0]?.options ?? {}
    const { maxAge: _clearedMaxAge, ...clearedOptions } =
      cleared.cleared[0]?.options ?? {}

    expect(cleared.cleared[0]?.name).toBe(AUTH_COOKIE_NAME)
    expect(clearedOptions).toEqual(setOptions)
    expect(cleared.cleared[0]?.options?.maxAge).toBeUndefined()
  })

  it('clears the cookie with the same production attributes', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('JWT_SECRET', env.JWT_SECRET)
    vi.resetModules()

    const { res, cleared } = fakeResponse()
    const production = await import('#utils/auth')

    production.clearAuthCookie(res)

    expect(cleared[0]?.options?.httpOnly).toBe(true)
    expect(cleared[0]?.options?.path).toBe('/')
    expect(cleared[0]?.options?.secure).toBe(true)
    expect(cleared[0]?.options?.sameSite).toBe('none')
  })
})
