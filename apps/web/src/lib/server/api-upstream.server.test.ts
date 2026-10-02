import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  API_UPSTREAM_ENV_VAR,
  ApiUpstreamConfigError,
  buildProxyResponseHeaders,
  buildUpstreamRequestHeaders,
  forwardApiRequest,
  getCurrentUserFromRequest,
  isSafeMethod,
  MAX_REQUEST_BODY_BYTES,
  parseApiUpstreamUrl,
  ProxyPathError,
  readBoundedBody,
  RequestBodyTooLargeError,
  resolveForwardedOrigin,
  stripCookieDomain,
  toUpstreamPathname,
} from '#/lib/server/api-upstream.server'

import type { SessionUser } from '#/lib/session'

// The real Start runtime only resolves inside a running server, so mock the two
// helpers the module reads. `vi.mock` is hoisted above the import, so the module
// under test still sees the stand-in.
const requestUrl = { value: 'https://dashnode.example/api/auth/me' }
const requestHeaders = new Headers()

vi.mock('@tanstack/react-start/server', () => ({
  getRequestUrl: () => new URL(requestUrl.value),
  getRequestHeader: (name: string) => requestHeaders.get(name) ?? undefined,
}))

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
    // Built by hand rather than via `json`: folding cookies into one value is
    // exactly the bug that would hide a broken relay.
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

  it('forwards a HEAD read as the read it is, with no body to send', async () => {
    // The route claims no `HEAD` handler: Start answers it with GET, so this
    // call has to stay a read with no body.
    stubApi(() => new Response(null, { status: 200 }))

    const response = await forwardApiRequest(
      new Request(`${WEB_ORIGIN}/api/posts`, { method: 'HEAD' }),
      'posts',
    )

    expect(response.status).toBe(200)
    expect(sent?.init.method).toBe('HEAD')
    expect(sent?.init.body).toBeNull()
  })

  it('passes a bodyless status through without inventing a body for it', async () => {
    // `Response` refuses a body on these statuses and the API sends none, so
    // drop the upstream stream rather than forward it into a throw.
    for (const status of [204, 205, 304]) {
      stubApi(() => new Response(null, { status }))

      const response = await forwardApiRequest(
        new Request(`${WEB_ORIGIN}/api/posts`, {
          method: 'DELETE',
          headers: { Origin: WEB_ORIGIN },
        }),
        'posts',
      )

      expect(response.status, String(status)).toBe(status)
      expect(response.body, String(status)).toBeNull()
    }
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

// The pure rules `forwardApiRequest` composes. They take plain values, not a
// request object, so each is checked on its own.

function browserRequest(
  method: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Request {
  return new Request(`${WEB_ORIGIN}/api/auth/login`, { method, ...init })
}

describe('parseApiUpstreamUrl', () => {
  it('accepts a bare http(s) origin', () => {
    expect(parseApiUpstreamUrl('http://localhost:8000', false).origin).toBe(
      'http://localhost:8000',
    )
    expect(parseApiUpstreamUrl('https://api.internal:8443', true).origin).toBe(
      'https://api.internal:8443',
    )
  })

  it('falls back to the local API address only outside production', () => {
    expect(parseApiUpstreamUrl(undefined, false).origin).toBe(
      'http://localhost:8000',
    )
    expect(parseApiUpstreamUrl('   ', false).origin).toBe(
      'http://localhost:8000',
    )
    expect(() => parseApiUpstreamUrl(undefined, true)).toThrow(
      ApiUpstreamConfigError,
    )
  })

  it('refuses anything that is not a plain origin', () => {
    const refused = [
      'localhost:8000',
      'ftp://localhost:8000',
      'http://user:pass@localhost:8000',
      'http://localhost:8000/api',
      'http://localhost:8000?token=1',
      'http://localhost:8000#frag',
      'http://',
    ]

    for (const value of refused) {
      expect(() => parseApiUpstreamUrl(value, true), value).toThrow(
        ApiUpstreamConfigError,
      )
    }
  })

  it('names the variable it is complaining about', () => {
    expect(() => parseApiUpstreamUrl('nope', true)).toThrow(
      new RegExp(API_UPSTREAM_ENV_VAR),
    )
  })
})

describe('toUpstreamPathname', () => {
  it('strips the proxy prefix from a splat', () => {
    expect(toUpstreamPathname('health')).toBe('/health')
    expect(toUpstreamPathname('auth/me')).toBe('/auth/me')
    expect(toUpstreamPathname('posts/mine/list')).toBe('/posts/mine/list')
    expect(toUpstreamPathname('tags/react/posts')).toBe('/tags/react/posts')
    expect(toUpstreamPathname('posts/65f0c1a2b3c4d5e6f7a8b9c0')).toBe(
      '/posts/65f0c1a2b3c4d5e6f7a8b9c0',
    )
  })

  it('maps an empty splat to the origin root', () => {
    expect(toUpstreamPathname(undefined)).toBe('/')
    expect(toUpstreamPathname('')).toBe('/')
  })

  it('never double-prefixes the proxy path', () => {
    expect(toUpstreamPathname('auth/me')).not.toBe('/api/auth/me')
  })

  it('refuses a splat that could leave the API path', () => {
    const refused = [
      '..',
      '../secret',
      'auth/../../secret',
      'auth/..',
      '.',
      'auth\\me',
      'auth%2fme',
      'auth?admin=1',
      'auth#x',
      'http://evil.example/health',
      'auth/me%00',
    ]

    for (const splat of refused) {
      expect(() => toUpstreamPathname(splat), splat).toThrow(ProxyPathError)
    }
  })

  it('can only ever produce a plain path under the origin root', () => {
    // Empty segments normalize away (`/api//auth/me` == `/api/auth/me`), but the
    // result must stay a plain path, or assigning it to the upstream URL could
    // redirect the request.
    for (const splat of ['//evil.example/health', 'auth//me', '/health']) {
      const pathname = toUpstreamPathname(splat)

      expect(pathname.startsWith('/'), splat).toBe(true)
      expect(pathname.startsWith('//'), splat).toBe(false)
      expect(/[\\?#:]/.test(pathname), splat).toBe(false)
      expect(pathname.split('/').includes('..'), splat).toBe(false)
    }
  })
})

describe('isSafeMethod', () => {
  it('treats only the two read methods as safe', () => {
    expect(isSafeMethod('GET')).toBe(true)
    expect(isSafeMethod('HEAD')).toBe(true)

    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      expect(isSafeMethod(method), method).toBe(false)
    }
  })
})

describe('resolveForwardedOrigin', () => {
  const headersWith = (origin?: string) =>
    new Headers(origin === undefined ? {} : { Origin: origin })

  it('accepts a matching origin, including for login and register', () => {
    expect(resolveForwardedOrigin(headersWith(WEB_ORIGIN), WEB_ORIGIN)).toBe(
      WEB_ORIGIN,
    )
  })

  it('refuses a missing, opaque, foreign, or unparseable origin', () => {
    const refused = [
      undefined,
      'null',
      'https://attacker.example',
      'not a url',
      'https://dashnode.example.attacker.example',
    ]

    for (const declared of refused) {
      expect(
        resolveForwardedOrigin(headersWith(declared), WEB_ORIGIN),
        String(declared),
      ).toBeNull()
    }
  })
})

describe('buildUpstreamRequestHeaders', () => {
  it('keeps the session cookie and content type, and the rest of the request', () => {
    const request = browserRequest('POST', {
      body: '{}',
      headers: {
        Cookie: 'token=jwt',
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Accept-Language': 'en-GB',
      },
    })

    const headers = buildUpstreamRequestHeaders(request, WEB_ORIGIN)

    expect(headers.get('cookie')).toBe('token=jwt')
    expect(headers.get('content-type')).toBe('application/json')
    expect(headers.get('accept')).toBe('application/json')
    expect(headers.get('accept-language')).toBe('en-GB')
  })

  it('drops hop-by-hop, forwarding, and body-framing headers', () => {
    const request = browserRequest('POST', {
      body: '{}',
      headers: {
        Connection: 'keep-alive',
        'Transfer-Encoding': 'chunked',
        Upgrade: 'websocket',
        'X-Forwarded-For': '203.0.113.7',
        'X-Forwarded-Host': 'attacker.example',
        'X-Forwarded-Proto': 'https',
        Forwarded: 'for=203.0.113.7',
        Via: '1.1 attacker',
        'X-Real-IP': '203.0.113.7',
        Host: 'attacker.example',
        'Content-Length': '9999',
      },
    })

    const headers = buildUpstreamRequestHeaders(request, WEB_ORIGIN)

    for (const name of [
      'connection',
      'transfer-encoding',
      'upgrade',
      'x-forwarded-for',
      'x-forwarded-host',
      'x-forwarded-proto',
      'forwarded',
      'via',
      'x-real-ip',
      'host',
      'content-length',
    ]) {
      expect(headers.get(name), name).toBeNull()
    }
  })

  it('replaces the caller origin with the public one Express checks', () => {
    const request = browserRequest('POST', {
      body: '{}',
      headers: { Origin: WEB_ORIGIN },
    })

    const headers = buildUpstreamRequestHeaders(request, WEB_ORIGIN)

    expect(headers.get('origin')).toBe(WEB_ORIGIN)
  })
})

describe('stripCookieDomain', () => {
  it('leaves a host-only cookie exactly as the API wrote it', () => {
    const cookie =
      'token=jwt; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=604800'

    expect(stripCookieDomain(cookie)).toBe(cookie)
  })

  it('drops a Domain attribute that would bind the cookie elsewhere', () => {
    expect(
      stripCookieDomain('token=jwt; Domain=api.internal; Path=/; HttpOnly'),
    ).toBe('token=jwt; Path=/; HttpOnly')
    expect(stripCookieDomain('token=jwt; domain = api.internal')).toBe(
      'token=jwt',
    )
  })

  it('handles a cookie with no attributes at all', () => {
    expect(stripCookieDomain('token=jwt')).toBe('token=jwt')
  })
})

describe('buildProxyResponseHeaders', () => {
  it('keeps each cookie on its own Set-Cookie line', () => {
    const upstream = new Headers({ 'Content-Type': 'application/json' })
    upstream.append('Set-Cookie', 'token=jwt; Path=/; HttpOnly')
    upstream.append('Set-Cookie', 'other=1; Path=/')

    const headers = buildProxyResponseHeaders(upstream)

    expect(headers.getSetCookie()).toEqual([
      'token=jwt; Path=/; HttpOnly',
      'other=1; Path=/',
    ])
  })

  it('marks the response as private and uncacheable', () => {
    const upstream = new Headers({ 'Cache-Control': 'public, max-age=60' })

    expect(buildProxyResponseHeaders(upstream).get('cache-control')).toBe(
      'private, no-store',
    )
  })

  it('passes the content type through but not CORS or encoding headers', () => {
    const upstream = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': WEB_ORIGIN,
      'Access-Control-Allow-Credentials': 'true',
      'Content-Encoding': 'gzip',
      'Content-Length': '41',
      ETag: 'W/"abc"',
      Vary: 'Origin',
    })

    const headers = buildProxyResponseHeaders(upstream)

    expect(headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(headers.get('etag')).toBe('W/"abc"')
    expect(headers.get('vary')).toBe('Origin')
    expect(headers.get('access-control-allow-origin')).toBeNull()
    expect(headers.get('access-control-allow-credentials')).toBeNull()
    expect(headers.get('content-encoding')).toBeNull()
    expect(headers.get('content-length')).toBeNull()
  })
})

describe('readBoundedBody', () => {
  const decode = (body: ArrayBuffer | null) =>
    body === null ? null : new TextDecoder().decode(body)

  it('returns the body unchanged when it fits', async () => {
    const request = browserRequest('POST', {
      body: '{"email":"a@b.test"}',
      headers: { 'Content-Type': 'application/json' },
    })

    expect(decode(await readBoundedBody(request, MAX_REQUEST_BODY_BYTES))).toBe(
      '{"email":"a@b.test"}',
    )
  })

  it('reports no body when there is none', async () => {
    expect(await readBoundedBody(browserRequest('DELETE'), 1024)).toBeNull()
  })

  it('refuses a body the API would refuse, by declared length', async () => {
    const request = browserRequest('POST', {
      body: 'x'.repeat(2048),
      headers: { 'Content-Length': '2048' },
    })

    await expect(readBoundedBody(request, 1024)).rejects.toThrow(
      RequestBodyTooLargeError,
    )
  })

  it('refuses a body that lies about its length', async () => {
    const oversize = 'x'.repeat(4096)
    const request = new Request(`${WEB_ORIGIN}/api/posts`, {
      method: 'POST',
      body: oversize,
      // A stream the runtime may deliver in pieces, so there is no length to check.
      headers: { 'Content-Length': '16' },
      // @ts-expect-error `duplex` is required by Node for streamed bodies but
      // missing from the DOM types this project compiles against.
      duplex: 'half',
    })

    await expect(readBoundedBody(request, 1024)).rejects.toThrow(
      RequestBodyTooLargeError,
    )
  })
})
