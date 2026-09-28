import request from 'supertest'

import { App } from '#/app'
import { corsOrigins } from '#config/cors'
import type { SafeUser } from '#services/auth'
import { AUTH_COOKIE_NAME } from '#utils/auth'

/** A supertest agent that keeps its cookies, one per test session. */
export type Agent = ReturnType<typeof request.agent>

/**
 * The whole app, not just `apiRouter`: the body parser, cookie parser, CORS and
 * the error handler are what the `400`/`413`/`415` and `404` rules depend on.
 * No port is bound.
 */
export function api() {
  return request(App())
}

/** The `Origin` value every state-changing request has to send. */
export function trustedOrigin(): string {
  const [origin] = corsOrigins

  if (origin === undefined) {
    throw new Error('CORS_ORIGIN lists no origin to trust')
  }

  return origin
}

/** A signed-in agent, plus the session itself for the tests that replay it. */
export interface Session {
  agent: Agent
  user: SafeUser
  /** The raw JWT from the session cookie. */
  token: string
  /** A `Cookie` header carrying `token`, for a deliberate replay. */
  cookie: string
}

function readSessionToken(setCookie: string | string[] | undefined): string {
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie ?? '']
  const authCookie = cookies.find((cookie) =>
    cookie.startsWith(`${AUTH_COOKIE_NAME}=`),
  )
  const token = authCookie?.slice(AUTH_COOKIE_NAME.length + 1).split(';')[0]

  if (!token) {
    throw new Error('The response set no session cookie')
  }

  return token
}

function session(response: request.Response, agent: Agent): Session {
  const token = readSessionToken(response.headers['set-cookie'])

  return {
    agent,
    user: response.body.user as SafeUser,
    token,
    cookie: `${AUTH_COOKIE_NAME}=${token}`,
  }
}

export interface Credentials {
  email: string
  password: string
}

export interface Registration extends Partial<Credentials> {
  name?: string
}

/**
 * Registers through the real route and keeps the cookie the response set, so
 * the session flow is exercised rather than stubbed.
 */
export async function registeredSession(
  credentials: Registration = {},
): Promise<Session> {
  const agent = request.agent(App())
  const response = await agent
    .post('/api/auth/register')
    .set('Origin', trustedOrigin())
    .send({
      name: credentials.name ?? 'Test User',
      email: credentials.email ?? 'session@example.com',
      password: credentials.password ?? 'correct-horse-battery',
    })

  return session(response, agent)
}

/** A second session for an existing account, for the tests that need two. */
export async function loggedInSession(
  credentials: Credentials,
): Promise<Session> {
  const agent = request.agent(App())
  const response = await agent
    .post('/api/auth/login')
    .set('Origin', trustedOrigin())
    .send(credentials)

  return session(response, agent)
}
