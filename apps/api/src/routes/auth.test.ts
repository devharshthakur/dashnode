import { describe, expect, it } from 'vitest'
import { decodeJwt, SignJWT } from 'jose'
import { Types } from 'mongoose'

import { PASSWORD_MAX_BYTES } from '#config/constants'
import { env } from '#env'
import {
  api,
  loggedInSession,
  registeredSession,
  trustedOrigin,
} from '#test/app'
import { createUser, TEST_PASSWORD } from '#test/factories'
import { AUTH_COOKIE_NAME } from '#utils/auth'

const ORIGIN = 'http://localhost:5173'
const CREDENTIALS = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'correct-horse-battery',
}

/** The `Set-Cookie` entry for the session cookie, split into its attributes. */
function authCookie(setCookie: string | string[] | undefined): {
  value: string
  attributes: Map<string, string>
} {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
  const entry = cookies.find((cookie) =>
    cookie.startsWith(`${AUTH_COOKIE_NAME}=`),
  )

  if (!entry) {
    throw new Error(`No ${AUTH_COOKIE_NAME} cookie in ${String(setCookie)}`)
  }

  const [pair, ...rest] = entry.split(';')

  return {
    value: (pair ?? '').slice(AUTH_COOKIE_NAME.length + 1),
    attributes: new Map(
      rest.map((part) => {
        const [name, value = ''] = part.trim().split('=')

        return [name?.toLowerCase() ?? '', value]
      }),
    ),
  }
}

describe('POST /api/auth/register', () => {
  it('creates the account and answers 201 with its public shape', async () => {
    const response = await api()
      .post('/api/auth/register')
      .set('Origin', ORIGIN)
      .send(CREDENTIALS)

    expect(response.status).toBe(201)
    expect(Object.keys(response.body.user).sort()).toEqual([
      'avatarUrl',
      'bio',
      'createdAt',
      'email',
      'id',
      'name',
      'updatedAt',
    ])
    expect(response.body.user).not.toHaveProperty('password')
  })

  it('sets the session cookie where JavaScript cannot read it', async () => {
    const response = await api()
      .post('/api/auth/register')
      .set('Origin', ORIGIN)
      .send(CREDENTIALS)

    const { value, attributes } = authCookie(response.headers['set-cookie'])

    expect(value.split('.')).toHaveLength(3)
    expect(attributes.get('httponly')).toBeDefined()
    expect(attributes.get('path')).toBe('/')
    expect(attributes.get('samesite')).toBe('Lax')
  })

  it.each([
    ['a value that is not an email', { email: 'nope' }, 'email'],
    ['a short password', { password: '1234567' }, 'password'],
    [
      'a password over the byte ceiling',
      { password: 'é'.repeat(PASSWORD_MAX_BYTES / 2 + 1) },
      'password',
    ],
  ])('answers 400 with details for %s', async (_case, override, path) => {
    const response = await api()
      .post('/api/auth/register')
      .set('Origin', ORIGIN)
      .send({ ...CREDENTIALS, ...override })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Validation Error')
    expect(
      response.body.details.some(
        (detail: { path: string }) => detail.path === path,
      ),
    ).toBe(true)
    for (const detail of response.body.details) {
      expect(typeof detail.message).toBe('string')
    }
  })

  it('answers 409 when the email is already registered', async () => {
    await api()
      .post('/api/auth/register')
      .set('Origin', ORIGIN)
      .send(CREDENTIALS)

    const response = await api()
      .post('/api/auth/register')
      .set('Origin', ORIGIN)
      .send({ ...CREDENTIALS, name: 'Someone Else' })

    expect(response.status).toBe(409)
    expect(response.body).toEqual({
      error: 'An account with this email already exists',
    })
  })

  it('answers 409 when only the casing of the email differs', async () => {
    await api()
      .post('/api/auth/register')
      .set('Origin', ORIGIN)
      .send(CREDENTIALS)

    const response = await api()
      .post('/api/auth/register')
      .set('Origin', ORIGIN)
      .send({ ...CREDENTIALS, email: 'ADA@Example.com' })

    expect(response.status).toBe(409)
  })

  // The registration response is itself a session, so a client never has to log
  // in right after signing up.
  it('authenticates the next request with the cookie it set', async () => {
    const session = await registeredSession(CREDENTIALS)

    const response = await session.agent.get('/api/auth/me')

    expect(response.status).toBe(200)
    expect(response.body.user.id).toBe(session.user.id)
  })
})

describe('POST /api/auth/login', () => {
  it('answers 200 with the same user shape', async () => {
    await createUser(CREDENTIALS)

    const response = await api()
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: CREDENTIALS.email, password: CREDENTIALS.password })

    expect(response.status).toBe(200)
    expect(Object.keys(response.body.user).sort()).toEqual([
      'avatarUrl',
      'bio',
      'createdAt',
      'email',
      'id',
      'name',
      'updatedAt',
    ])
  })

  // The revocation key is the `jti`: a second login must not replace or reuse
  // the first session's, or one logout would end both.
  it('issues a token with its own id', async () => {
    const first = await registeredSession(CREDENTIALS)
    const second = await loggedInSession({
      email: CREDENTIALS.email,
      password: CREDENTIALS.password,
    })

    expect(decodeJwt(second.token).jti).not.toBe(decodeJwt(first.token).jti)
  })

  it('answers 400 for an invalid body', async () => {
    const response = await api()
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'nope' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Validation Error')
  })

  // Byte-identical, so the response cannot reveal which emails are registered.
  it('answers 401 identically for a wrong password and an unknown email', async () => {
    await createUser(CREDENTIALS)

    const wrongPassword = await api()
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: CREDENTIALS.email, password: 'not-the-password' })
    const unknownEmail = await api()
      .post('/api/auth/login')
      .set('Origin', ORIGIN)
      .send({ email: 'nobody@example.com', password: CREDENTIALS.password })

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.body).toEqual({ error: 'Invalid email or password' })
    expect(unknownEmail.text).toBe(wrongPassword.text)
  })
})

describe('GET /api/auth/me', () => {
  it('answers 200 with the signed-in user and no password', async () => {
    const session = await registeredSession({ email: 'me@example.com' })

    const response = await session.agent.get('/api/auth/me')

    expect(response.status).toBe(200)
    expect(response.body.user.email).toBe('me@example.com')
    expect(response.body.user).not.toHaveProperty('password')
  })

  it('answers 401 with no cookie', async () => {
    const response = await api().get('/api/auth/me')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({ error: 'Unauthorized' })
  })

  it('answers 401 with a garbage cookie', async () => {
    const response = await api()
      .get('/api/auth/me')
      .set('Cookie', `${AUTH_COOKIE_NAME}=garbage`)

    expect(response.status).toBe(401)
  })

  it('answers 401 with an expired cookie', async () => {
    const expired = await new SignJWT()
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(new Types.ObjectId().toHexString())
      .setJti('expired')
      .setExpirationTime('-10s')
      .sign(new TextEncoder().encode(env.JWT_SECRET))

    const response = await api()
      .get('/api/auth/me')
      .set('Cookie', `${AUTH_COOKIE_NAME}=${expired}`)

    expect(response.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the session cookie with the attributes it was set with', async () => {
    const session = await registeredSession({ email: 'clear@example.com' })

    const response = await session.agent
      .post('/api/auth/logout')
      .set('Origin', ORIGIN)

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ message: 'Logged out' })
    const { value, attributes } = authCookie(response.headers['set-cookie'])
    expect(value).toBe('')
    expect(attributes.get('path')).toBe('/')
    expect(attributes.get('samesite')).toBe('Lax')
  })

  // The whole point of the blacklist: the cookie is still on the client, and it
  // has to stop working. A replay, not a stub.
  it('refuses the session token once it has been revoked', async () => {
    const session = await registeredSession({ email: 'replay@example.com' })

    await session.agent.post('/api/auth/logout').set('Origin', ORIGIN)
    const replay = await api().get('/api/auth/me').set('Cookie', session.cookie)

    expect(replay.status).toBe(401)
  })

  it('refuses a request from an untrusted origin', async () => {
    const session = await registeredSession({ email: 'origin@example.com' })

    const response = await session.agent
      .post('/api/auth/logout')
      .set('Origin', 'https://evil.example.com')

    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'Forbidden' })
  })

  it('refuses a request with the opaque origin', async () => {
    const session = await registeredSession({ email: 'opaque@example.com' })

    const response = await session.agent
      .post('/api/auth/logout')
      .set('Origin', 'null')

    expect(response.status).toBe(403)
  })

  // There is nothing to revoke in either case, and neither is an error.
  it('answers 200 without a cookie, and with one it cannot verify', async () => {
    const noCookie = await api()
      .post('/api/auth/logout')
      .set('Origin', trustedOrigin())
    const unverifiable = await api()
      .post('/api/auth/logout')
      .set('Origin', trustedOrigin())
      .set('Cookie', `${AUTH_COOKIE_NAME}=not-a-token`)

    expect(noCookie.status).toBe(200)
    expect(unverifiable.status).toBe(200)
  })

  it('is harmless when the same session logs out twice', async () => {
    const session = await registeredSession({ email: 'twice@example.com' })

    const first = await session.agent
      .post('/api/auth/logout')
      .set('Origin', ORIGIN)
    const second = await session.agent
      .post('/api/auth/logout')
      .set('Origin', ORIGIN)

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
  })

  it('leaves the user’s other session alone', async () => {
    const user = await createUser({
      email: 'two@example.com',
      password: TEST_PASSWORD,
    })
    const first = await loggedInSession({
      email: 'two@example.com',
      password: TEST_PASSWORD,
    })
    const second = await loggedInSession({
      email: 'two@example.com',
      password: TEST_PASSWORD,
    })
    expect(user.id).toBe(first.user.id)

    await first.agent.post('/api/auth/logout').set('Origin', ORIGIN)

    await expect(first.agent.get('/api/auth/me')).resolves.toMatchObject({
      status: 401,
    })
    await expect(second.agent.get('/api/auth/me')).resolves.toMatchObject({
      status: 200,
    })
  })
})

describe('GET /api/health', () => {
  it('answers 200 with no session and no origin', async () => {
    const response = await api().get('/api/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(typeof response.body.uptime).toBe('number')
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false)
  })
})
