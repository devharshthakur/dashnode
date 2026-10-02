import { describe, expect, it } from 'vitest'

import {
  API_UPSTREAM_ENV_VAR,
  ApiUpstreamConfigError,
  buildProxyResponseHeaders,
  buildUpstreamRequestHeaders,
  isSafeMethod,
  MAX_REQUEST_BODY_BYTES,
  parseApiUpstreamUrl,
  ProxyPathError,
  readBoundedBody,
  RequestBodyTooLargeError,
  resolveForwardedOrigin,
  stripCookieDomain,
  toUpstreamPathname,
} from '#/lib/server/api-proxy'

const WEB_ORIGIN = 'https://dashnode.example'

function browserRequest(
  method: string,
  init: RequestInit & { headers?: Record<string, string> } = {},
): Request {
  return new Request('https://dashnode.example/api/auth/login', {
    method,
    ...init,
  })
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
    // Empty segments normalize away, which is what `/api//auth/me` and
    // `/api/auth/me` mean the same thing — but the result must still be a plain
    // path, or assigning it to the upstream URL could redirect the request.
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
    const request = new Request('https://dashnode.example/api/posts', {
      method: 'POST',
      body: oversize,
      // A stream the runtime may deliver in pieces, with no length to check.
      headers: { 'Content-Length': '16' },
      // @ts-expect-error `duplex` is required by Node for a streamed body and is
      // not yet in the DOM types this project compiles against.
      duplex: 'half',
    })

    await expect(readBoundedBody(request, 1024)).rejects.toThrow(
      RequestBodyTooLargeError,
    )
  })
})
