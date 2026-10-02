import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SessionUser } from '#/lib/session'

// The real module pulls in Start's runtime, which only resolves inside a running
// server. Standing in for it keeps these tests to the two things that matter
// here: what goes out to the API, and how its answer comes back.
const requestUrl = { value: 'https://dashnode.example/api/auth/me' }
const requestHeaders = new Headers()

vi.mock('@tanstack/react-start/server', () => ({
  getRequestUrl: () => new URL(requestUrl.value),
  getRequestHeader: (name: string) => requestHeaders.get(name) ?? undefined,
}))

const { forwardApiRequest, getCurrentUserFromRequest } =
  await import('#/lib/server/api-upstream.server')

const WEB_ORIGIN = 'https://dashnode.example'
const API_ORIGIN = 'http://localhost:8000'

const user: SessionUser = {
  id: '65f0c1a2b3c4d5e6f7a8b9c0',
  name: 'Ada Lovelace',
  email: 'ada@example.test',
  bio: '',
  avatarUrl: '',
}

/** The last request the proxy made to the API. */
let sent: { url: URL; init: RequestInit } | undefined

function stubApi(respond: (url: URL, init: RequestInit) => Response | never) {
  vi.stubGlobal('fetch', (input: URL | string, init: RequestInit = {}) => {
    sent = { url: new URL(input.toString()), init }
    return Promise.resolve(respond(sent.url, init))
  })
}

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  })

beforeEach(() => {
  sent = undefined
  requestUrl.value = `${WEB_ORIGIN}/api/auth/me`
  requestHeaders.delete('cookie')
  vi.stubEnv('API_UPSTREAM_URL', API_ORIGIN)
  vi.stubEnv('NODE_ENV', 'production')
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('forwardApiRequest', () => {
  it('maps /api/<path> onto the API root and keeps the query string', async () => {
    stubApi(() => json({ posts: [] }))

    const response = await forwardApiRequest(
      new Request(`${WEB_ORIGIN}/api/posts?tag=react&page=2`, {
        headers: { Accept: 'application/json' },
      }),
      'posts',
    )

    expect(sent?.url.href).toBe(`${API_ORIGIN}/posts?tag=react&page=2`)
    expect(sent?.init.method).toBe('GET')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    await expect(response.json()).resolves.toEqual({ posts: [] })
  })

  it('forwards the session cookie and the public origin, not the caller headers', async () => {
    stubApi(() => json({ message: 'Logged out' }))

    await forwardApiRequest(
      new Request(`${WEB_ORIGIN}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Cookie: 'token=jwt',
          Origin: WEB_ORIGIN,
          'X-Forwarded-Host': 'attacker.example',
        },
      }),
      'auth/logout',
    )

    const headers = new Headers(sent?.init.headers)
    expect(headers.get('cookie')).toBe('token=jwt')
    expect(headers.get('origin')).toBe(WEB_ORIGIN)
    expect(headers.get('x-forwarded-host')).toBeNull()
  })

  it('forwards the request body unchanged', async () => {
    stubApi(() => json({ user }, 201))

    const payload = JSON.stringify({
      name: 'Ada',
      email: 'a@b.test',
      password: 'x',
    })
    const response = await forwardApiRequest(
      new Request(`${WEB_ORIGIN}/api/auth/register`, {
        method: 'POST',
        body: payload,
        headers: { 'Content-Type': 'application/json', Origin: WEB_ORIGIN },
      }),
      'auth/register',
    )

    expect(new TextDecoder().decode(sent?.init.body as ArrayBuffer)).toBe(
      payload,
    )
    expect(response.status).toBe(201)
  })

  it('keeps an upstream failure distinguishable from a proxy failure', async () => {
    stubApi(() => json({ error: 'Email already taken' }, 409))

    const response = await forwardApiRequest(
      new Request(`${WEB_ORIGIN}/api/auth/register`, {
        method: 'POST',
        body: '{}',
        headers: { Origin: WEB_ORIGIN },
      }),
      'auth/register',
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: 'Email already taken',
    })
  })

  it('relays each Set-Cookie on its own line, with the Domain dropped', async () => {
    // Built by hand rather than through `json`, because folding the cookies into
    // a plain object is exactly the mistake that would hide a broken relay.
    stubApi(() => {
      const headers = new Headers({ 'Content-Type': 'application/json' })
      headers.append(
        'Set-Cookie',
        'token=jwt; Domain=api.internal; Path=/; HttpOnly; Secure; SameSite=None',
      )
      headers.append('Set-Cookie', 'other=1; Path=/')

      return new Response(JSON.stringify({ user }), { status: 200, headers })
    })

    const response = await forwardApiRequest(
      new Request(`${WEB_ORIGIN}/api/auth/login`, {
        method: 'POST',
        body: '{}',
        headers: { Origin: WEB_ORIGIN },
      }),
      'auth/login',
    )

    expect(response.headers.getSetCookie()).toEqual([
      'token=jwt; Path=/; HttpOnly; Secure; SameSite=None',
      'other=1; Path=/',
    ])
  })

  it('refuses a cross-site write before it reaches the API, including login', async () => {
    stubApi(() => json({ user }))

    for (const origin of ['https://attacker.example', 'null', undefined]) {
      sent = undefined

      const response = await forwardApiRequest(
        new Request(`${WEB_ORIGIN}/api/auth/login`, {
          method: 'POST',
          body: '{}',
          headers: origin === undefined ? {} : { Origin: origin },
        }),
        'auth/login',
      )

      expect(response.status, String(origin)).toBe(403)
      expect(sent, String(origin)).toBeUndefined()
    }
  })

  it('does not apply the origin check to reads', async () => {
    stubApi(() => json({ user: null }, 401))

    const response = await forwardApiRequest(
      new Request(`${WEB_ORIGIN}/api/posts`),
      'posts',
    )

    expect(response.status).toBe(401)
    expect(sent?.url.href).toBe(`${API_ORIGIN}/posts`)
  })

  it('answers 413 for a body over the API limit without calling it', async () => {
    stubApi(() => json({}))

    const response = await forwardApiRequest(
      new Request(`${WEB_ORIGIN}/api/posts`, {
        method: 'POST',
        body: 'x'.repeat(1_048_577),
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': '1048577',
          Origin: WEB_ORIGIN,
        },
      }),
      'posts',
    )

    expect(response.status).toBe(413)
    expect(sent).toBeUndefined()
  })

  it('answers 404 for a path that is not an API path', async () => {
    stubApi(() => json({}))

    const response = await forwardApiRequest(
      new Request(`${WEB_ORIGIN}/api/nope`),
      '../etc/passwd',
    )

    expect(response.status).toBe(404)
    expect(sent).toBeUndefined()
  })

  it('answers 502 without leaking the upstream address when it cannot be reached', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('ECONNREFUSED')))

    const response = await forwardApiRequest(
      new Request(`${WEB_ORIGIN}/api/posts`),
      'posts',
    )

    expect(response.status).toBe(502)
    await expect(response.text()).resolves.toBe(
      JSON.stringify({ error: 'Bad Gateway' }),
    )
  })

  it('answers 502 rather than guessing an address in production', async () => {
    vi.stubEnv('API_UPSTREAM_URL', '')
    stubApi(() => json({}))

    const response = await forwardApiRequest(
      new Request(`${WEB_ORIGIN}/api/posts`),
      'posts',
    )

    expect(response.status).toBe(502)
    expect(sent).toBeUndefined()
  })

  it('falls back to the local API address outside production', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('API_UPSTREAM_URL', '')
    stubApi(() => json({ status: 'ok' }))

    const response = await forwardApiRequest(
      new Request(`${WEB_ORIGIN}/api/health`),
      'health',
    )

    expect(sent?.url.origin).toBe(API_ORIGIN)
    expect(response.status).toBe(200)
  })
})

describe('getCurrentUserFromRequest', () => {
  it('asks the API for the session cookie on the request being handled', async () => {
    requestHeaders.set('cookie', 'token=jwt')
    stubApi(() => json({ user }))

    await expect(getCurrentUserFromRequest()).resolves.toEqual(user)
    expect(sent?.url.href).toBe(`${API_ORIGIN}/auth/me`)
    expect(new Headers(sent?.init.headers).get('cookie')).toBe('token=jwt')
  })

  it('reports a missing session as null, not as a failure', async () => {
    stubApi(() => json({ error: 'Unauthorized' }, 401))

    await expect(getCurrentUserFromRequest()).resolves.toBeNull()
  })

  it('throws when the API is broken, so a guard cannot mistake it for signed out', async () => {
    stubApi(() => json({ error: 'Internal Server Error' }, 500))

    await expect(getCurrentUserFromRequest()).rejects.toThrow(/500/)
  })

  it('throws when the API cannot be reached at all', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('ECONNREFUSED')))

    await expect(getCurrentUserFromRequest()).rejects.toThrow()
  })
})
