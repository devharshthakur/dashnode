import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignJWT } from 'jose'

import { RevokedToken } from '#models/revoked-token'
import { User } from '#models/user'
import { api } from '#test/app'
import { createUser } from '#test/factories'
import { AUTH_COOKIE_NAME, signSessionToken } from '#utils/auth'

// `GET /auth/me` is the shortest protected route: `requireAuth` either
// answers it or lets it run, so the middleware is what is under test here.
// Valid sessions, replay, and deleted users are exercised through the route
// suites; this file covers the middleware's own rejection reasons and its
// database-failure behavior.
const PROTECTED = '/auth/me'
const UNAUTHORIZED = { error: 'Unauthorized' }

function withCookie(token: string) {
  return api().get(PROTECTED).set('Cookie', `${AUTH_COOKIE_NAME}=${token}`)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('requireAuth without a usable session', () => {
  it('refuses a request that carries no cookie', async () => {
    const response = await api().get(PROTECTED)

    expect(response.status).toBe(401)
    expect(response.body).toEqual(UNAUTHORIZED)
  })

  // cookie-parser decodes a `j:`-prefixed value as JSON, so the cookie holds an
  // object rather than a token string. Sent under the real cookie name, this is
  // what actually reaches the middleware; a bracketed name would just be a
  // missing cookie.
  it('refuses a cookie whose value is not a string', async () => {
    const response = await api()
      .get(PROTECTED)
      .set(
        'Cookie',
        `${AUTH_COOKIE_NAME}=j:${JSON.stringify({ nested: 'value' })}`,
      )

    expect(response.status).toBe(401)
    expect(response.body).toEqual(UNAUTHORIZED)
  })

  it('refuses a malformed token', async () => {
    const response = await withCookie('not-a-token')

    expect(response.status).toBe(401)
    expect(response.body).toEqual(UNAUTHORIZED)
  })

  // Valid in every respect except the signing key, so the signature is the one
  // and only reason to refuse it.
  it('refuses a token signed with another secret', async () => {
    const user = await createUser()
    const token = await new SignJWT()
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setJti('a-jti')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('b'.repeat(32)))

    const response = await withCookie(token)

    expect(response.status).toBe(401)
    expect(response.body).toEqual(UNAUTHORIZED)
  })
})

describe('requireAuth when the session lookup fails', () => {
  // #22: a `401` here tells the client its session is gone, and the client then
  // throws away a cookie that is still perfectly valid. A database fault has to
  // surface as a `500` instead.
  it('answers 500 rather than 401 when the revocation lookup throws', async () => {
    const user = await createUser()
    const token = await signSessionToken(user.id)
    vi.spyOn(RevokedToken, 'exists').mockRejectedValueOnce(
      new Error('connection reset'),
    )

    const response = await withCookie(token)

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'Internal Server Error' })
  })

  it('answers 500 rather than 401 when the user lookup throws', async () => {
    const user = await createUser()
    const token = await signSessionToken(user.id)
    vi.spyOn(User, 'findById').mockImplementationOnce(() => {
      throw new Error('connection reset')
    })

    const response = await withCookie(token)

    expect(response.status).toBe(500)
  })
})
