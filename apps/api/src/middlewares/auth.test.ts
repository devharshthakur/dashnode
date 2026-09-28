import { afterEach, describe, expect, it, vi } from 'vitest'
import type { NextFunction, Request, Response } from 'express'
import { SignJWT } from 'jose'
import { Types } from 'mongoose'

import { env } from '#env'
import { requireAuth } from '#middlewares/auth'
import { RevokedToken } from '#models/revoked-token'
import { User } from '#models/user'
import { api, registeredSession } from '#test/app'
import { createUser, TEST_PASSWORD } from '#test/factories'
import { AUTH_COOKIE_NAME, signSessionToken } from '#utils/auth'

// `GET /api/auth/me` is the shortest protected route: `requireAuth` either
// answers it or lets it run, so the middleware is what is under test here.
const PROTECTED = '/api/auth/me'
const UNAUTHORIZED = { error: 'Unauthorized' }

const secret = new TextEncoder().encode(env.JWT_SECRET)

async function signToken(claims: {
  subject?: string
  jti?: string
  expiresIn?: string
}): Promise<string> {
  const builder = new SignJWT().setProtectedHeader({ alg: 'HS256' })

  if (claims.subject !== undefined) {
    builder.setSubject(claims.subject)
  }

  if (claims.jti !== undefined) {
    builder.setJti(claims.jti)
  }

  builder.setExpirationTime(claims.expiresIn ?? '1h')

  return builder.sign(secret)
}

function withCookie(token: string) {
  return api().get(PROTECTED).set('Cookie', `${AUTH_COOKIE_NAME}=${token}`)
}

afterEach(() => {
  vi.restoreAllMocks()
})

/** Records what a middleware answered, without an HTTP layer. */
function fakeResponse() {
  const answered: { status: number; body: unknown } = {
    status: 0,
    body: undefined,
  }
  const res = {
    status(code: number) {
      answered.status = code

      return res
    },
    json(body: unknown) {
      answered.body = body

      return res
    },
  } as unknown as Response

  return { res, answered }
}

describe('requireAuth with a cookie value it cannot use', () => {
  // cookie-parser only ever produces strings, so this defensive branch has no
  // HTTP request that reaches it — the middleware is driven directly instead.
  // The refusal is asserted as reaching it *before* any verification: left to
  // the verifier, a value that is not a string still ends in the same `401`, so
  // the log line is the only thing that tells the two apart.
  it('refuses a cookie value that is not a string', async () => {
    const { res, answered } = fakeResponse()
    const next = vi.fn()
    const req = {
      cookies: { [AUTH_COOKIE_NAME]: { nested: 'value' } },
      log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
    } as unknown as Request

    await requireAuth(req, res, next as unknown as NextFunction)

    expect(answered).toEqual({ status: 401, body: UNAUTHORIZED })
    expect(next).not.toHaveBeenCalled()
    expect(req.log?.debug).toHaveBeenCalledWith(
      'Request rejected: no session cookie',
    )
    expect(req.log?.warn).not.toHaveBeenCalled()
  })
})

describe('requireAuth without a usable session', () => {
  it('refuses a request that carries no cookie', async () => {
    const response = await api().get(PROTECTED)

    expect(response.status).toBe(401)
    expect(response.body).toEqual(UNAUTHORIZED)
  })

  // cookie-parser turns a bracketed key into an object, which is not a token.
  it('refuses a cookie whose value is not a string', async () => {
    const response = await api()
      .get(PROTECTED)
      .set('Cookie', `${AUTH_COOKIE_NAME}[nested]=value`)

    expect(response.status).toBe(401)
    expect(response.body).toEqual(UNAUTHORIZED)
  })

  it('refuses a malformed token', async () => {
    const response = await withCookie('not-a-token')

    expect(response.status).toBe(401)
    expect(response.body).toEqual(UNAUTHORIZED)
  })

  it('refuses a token signed with another secret', async () => {
    const token = await new SignJWT()
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(new Types.ObjectId().toHexString())
      .setJti('a-jti')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('b'.repeat(32)))

    const response = await withCookie(token)

    expect(response.status).toBe(401)
    expect(response.body).toEqual(UNAUTHORIZED)
  })

  it('refuses an expired token', async () => {
    const token = await signToken({
      subject: new Types.ObjectId().toHexString(),
      expiresIn: '-10s',
    })

    const response = await withCookie(token)

    expect(response.status).toBe(401)
  })
})

describe('requireAuth with a valid token', () => {
  it('lets the request through and attaches a hash-free user', async () => {
    const user = await createUser()
    const token = await signSessionToken(user.id)

    const response = await withCookie(token)

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({ id: user.id })
    expect(response.body.user).not.toHaveProperty('password')
  })

  it('accepts the cookie a registration set, without a separate login', async () => {
    const session = await registeredSession({
      email: 'cookie@example.com',
      password: TEST_PASSWORD,
    })

    const response = await session.agent.get(PROTECTED)

    expect(response.status).toBe(200)
    expect(response.body.user.id).toBe(session.user.id)
  })
})

describe('requireAuth with a revoked session', () => {
  // The user still exists here, so only the blacklist can refuse the request.
  it('refuses a token the logout route revoked', async () => {
    const session = await registeredSession({ email: 'logout@example.com' })
    const token = session.token

    const logout = await session.agent
      .post('/api/auth/logout')
      .set('Origin', 'http://localhost:5173')
    expect(logout.status).toBe(200)

    const response = await withCookie(token)

    expect(response.status).toBe(401)
    expect(response.body).toEqual(UNAUTHORIZED)
  })

  // The mirror image: the token verifies and is not revoked, but there is no
  // user behind it any more.
  it('refuses a valid token whose user has been deleted', async () => {
    const user = await createUser()
    const token = await signSessionToken(user.id)

    await User.deleteOne({ _id: user._id })

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
