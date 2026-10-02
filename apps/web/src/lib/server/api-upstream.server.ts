import { getRequestHeader, getRequestUrl } from '@tanstack/react-start/server'

import type { SessionUser } from '#/lib/session'

// `.server.ts` keeps this module out of the browser bundle (Start's import
// protection rejects client imports of `*.server.*`). It holds the API's
// address, which is private in production, so nothing here may reach the client.
//
// One module on purpose: it owns everything `src/routes/api/$.ts` forwards —
// upstream address, path mapping, the write-origin check, header filtering, and
// the response relay. The route file stays a thin delegate.

/** Environment variable naming the API origin this server forwards to. */
export const API_UPSTREAM_ENV_VAR = 'API_UPSTREAM_URL'

/** Used when nothing is configured, so local development needs no `.env`. */
const DEFAULT_API_UPSTREAM_URL = 'http://localhost:8000'

/**
 * Largest body the proxy forwards, matching the API's `bodyParser.json` limit
 * (`apps/api/src/app.ts`). Checking here avoids buffering what Express rejects.
 */
export const MAX_REQUEST_BODY_BYTES = 1_048_576

/** Value browsers send for an opaque origin, e.g. a sandboxed frame. */
const OPAQUE_ORIGIN = 'null'

/** Hop-by-hop headers (RFC 9110 §7.6.1): a proxy drops these, not relays them. */
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
])

/**
 * Request headers the proxy must not relay: hop-by-hop, the ones describing the
 * delivering hop rather than the visitor, and `content-length`, which `fetch`
 * recomputes for the body it sends.
 */
const REQUEST_HEADERS_TO_DROP = new Set([
  ...HOP_BY_HOP_HEADERS,
  'host',
  'forwarded',
  'via',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-real-ip',
  'content-length',
  'content-encoding',
])

/**
 * Response headers worth passing through. `content-encoding` and
 * `content-length` are absent because `fetch` already decoded the body;
 * `cache-control` and the upstream's CORS headers are handled below instead.
 */
const RESPONSE_HEADERS_TO_PASS = [
  'content-type',
  'content-language',
  'content-disposition',
  'etag',
  'last-modified',
  'location',
  'retry-after',
  'vary',
  'www-authenticate',
]

/**
 * Shape of a valid API path segment (router names, `mine`/`list`, slugs,
 * ObjectIds). Anything outside it cannot name an endpoint, so it is refused
 * rather than escaped.
 */
const PATH_SEGMENT = /^[\w.~-]+$/

/** A request path the proxy cannot express as a path on the API. */
export class ProxyPathError extends Error {
  constructor() {
    super('Request path is not a valid API path')
    this.name = 'ProxyPathError'
  }
}

/** A body over {@link MAX_REQUEST_BODY_BYTES}. */
export class RequestBodyTooLargeError extends Error {
  constructor() {
    super('Request body is too large')
    this.name = 'RequestBodyTooLargeError'
  }
}

/** A configured upstream that is not an origin the proxy can send requests to. */
export class ApiUpstreamConfigError extends Error {
  constructor(reason: string) {
    super(`Invalid ${API_UPSTREAM_ENV_VAR}: ${reason}`)
    this.name = 'ApiUpstreamConfigError'
  }
}

/** The API could not be reached, or is configured with an address that cannot serve it. */
class ApiUnreachableError extends Error {
  constructor() {
    super('The API is unreachable')
    this.name = 'ApiUnreachableError'
  }
}

/**
 * Reads and validates the API origin to forward to. Only a bare `http(s)`
 * origin is accepted — a path, credentials, query, or fragment would change
 * what the proxy means. Development falls back to the local API address;
 * production treats an unset value as an error rather than guessing.
 */
export function parseApiUpstreamUrl(
  raw: string | undefined,
  isProduction: boolean,
): URL {
  const configured = raw?.trim()

  if (configured === undefined || configured.length === 0) {
    if (isProduction) {
      throw new ApiUpstreamConfigError('it is not set')
    }

    return new URL(DEFAULT_API_UPSTREAM_URL)
  }

  let url: URL

  try {
    url = new URL(configured)
  } catch {
    throw new ApiUpstreamConfigError(`${configured} is not an absolute URL`)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApiUpstreamConfigError(`${configured} is not an http(s) URL`)
  }

  if (url.username !== '' || url.password !== '') {
    throw new ApiUpstreamConfigError(`${configured} carries credentials`)
  }

  if (url.search !== '' || url.hash !== '') {
    throw new ApiUpstreamConfigError(
      `${configured} carries a query or fragment`,
    )
  }

  if (url.pathname !== '/') {
    throw new ApiUpstreamConfigError(
      `${configured} carries a path; the API is mounted at the origin root`,
    )
  }

  return url
}

/**
 * Maps the route splat to the API path: `/api/auth/me` -> `/auth/me`, since
 * Express mounts at the root. Every segment is checked, so the result cannot
 * escape the origin, smuggle a query, or carry `..`/percent escapes.
 */
export function toUpstreamPathname(splat: string | undefined): string {
  const segments = (splat ?? '')
    .split('/')
    .filter((segment) => segment.length > 0)

  for (const segment of segments) {
    if (segment === '.' || segment === '..' || !PATH_SEGMENT.test(segment)) {
      throw new ProxyPathError()
    }
  }

  return `/${segments.join('/')}`
}

/**
 * Methods a cross-site page can send without a preflight, so they skip the
 * origin check. `HEAD` qualifies: Start answers it with the GET handler and
 * drops the body.
 */
export function isSafeMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD'
}

/**
 * The origin to forward for a state-changing request, or `null` to refuse it.
 * Browsers always send `Origin` on unsafe methods, so a missing or opaque
 * `null` one means the caller is not a page here — and the session cookie would
 * still ride along, so refuse rather than guess.
 */
export function resolveForwardedOrigin(
  headers: Headers,
  requestOrigin: string,
): string | null {
  const declared = headers.get('origin')

  if (declared === null || declared === OPAQUE_ORIGIN) {
    return null
  }

  let origin: string

  try {
    origin = new URL(declared).origin
  } catch {
    return null
  }

  return origin === requestOrigin ? origin : null
}

/**
 * Headers to send upstream: the browser's, minus what a proxy must not relay,
 * with the public origin in place of the caller's. The session cookie rides
 * along on its own — a same-origin request carries it, since JS cannot read an
 * HttpOnly cookie. The public origin is what the API's own origin check expects.
 */
export function buildUpstreamRequestHeaders(
  request: Request,
  forwardedOrigin: string,
): Headers {
  const headers = new Headers()

  for (const [name, value] of request.headers) {
    if (!REQUEST_HEADERS_TO_DROP.has(name.toLowerCase())) {
      headers.append(name, value)
    }
  }

  headers.set('Origin', forwardedOrigin)

  return headers
}

/**
 * Drops a `Domain` attribute so the browser stores the cookie for the web host
 * (a domain naming the API's host would be rejected). Every other attribute —
 * `HttpOnly`, `Secure`, `SameSite`, `Path`, expiry — is left as the API wrote it.
 */
export function stripCookieDomain(setCookie: string): string {
  const pairEnd = setCookie.indexOf(';')

  if (pairEnd === -1) {
    return setCookie
  }

  const attributes = setCookie
    .slice(pairEnd + 1)
    .split(';')
    .map((attribute) => attribute.trim())
    .filter((attribute) => !/^domain\s*=/i.test(attribute))

  return attributes.length > 0
    ? `${setCookie.slice(0, pairEnd)}; ${attributes.join('; ')}`
    : setCookie.slice(0, pairEnd)
}

/**
 * Cookies as separate values. `Headers.get` folds multiple `Set-Cookie` lines
 * into one string a browser cannot split, so prefer the runtime's list and fall
 * back to the single-line case.
 */
function getSetCookieValues(upstream: Headers): string[] {
  if (typeof upstream.getSetCookie === 'function') {
    return upstream.getSetCookie()
  }

  const combined = upstream.get('set-cookie')

  return combined === null ? [] : [combined]
}

/**
 * Headers to answer the browser with: the upstream's content metadata, each
 * cookie on its own `Set-Cookie` line, and a no-store policy for personalized
 * answers.
 */
export function buildProxyResponseHeaders(upstream: Headers): Headers {
  const headers = new Headers()

  for (const name of RESPONSE_HEADERS_TO_PASS) {
    const value = upstream.get(name)

    if (value !== null) {
      headers.set(name, value)
    }
  }

  // Everything under `/api/*` can depend on the caller's session, so nothing
  // here may be stored.
  headers.set('Cache-Control', 'private, no-store')

  for (const cookie of getSetCookieValues(upstream)) {
    headers.append('Set-Cookie', stripCookieDomain(cookie))
  }

  return headers
}

/**
 * Reads the body, refusing anything over the limit. `Content-Length` is only a
 * claim, so chunks are counted as they arrive; a request that lies about it or
 * omits it still cannot make this process hold more than the API would accept.
 */
export async function readBoundedBody(
  request: Request,
  maxBytes: number,
): Promise<ArrayBuffer | null> {
  const declared = Number(request.headers.get('content-length'))

  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new RequestBodyTooLargeError()
  }

  if (request.body === null) {
    return null
  }

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()

    if (done) {
      break
    }

    received += value.byteLength

    if (received > maxBytes) {
      await reader.cancel()
      throw new RequestBodyTooLargeError()
    }

    chunks.push(value)
  }

  const body = new Uint8Array(received)
  let offset = 0

  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  return body.buffer
}

/**
 * Reads the upstream URL per request, not at module scope: edge SSR runtimes
 * only populate the environment while handling a request, so a module-level
 * read would freeze `undefined` into the bundle.
 */
function getApiUpstreamUrl(): URL {
  return parseApiUpstreamUrl(
    process.env[API_UPSTREAM_ENV_VAR],
    process.env.NODE_ENV === 'production',
  )
}

interface UpstreamCall {
  method: string
  /** Path below the API's own root, as it arrived after the `/api/` prefix. */
  splat: string | undefined
  search: string
  headers: Headers
  body: ArrayBuffer | null
}

async function callUpstream(call: UpstreamCall): Promise<Response> {
  const target = getApiUpstreamUrl()
  target.pathname = toUpstreamPathname(call.splat)
  target.search = call.search

  try {
    // `manual`: following a redirect would let the API steer this process at an
    // address of its choosing. No endpoint here redirects.
    return await fetch(target, {
      method: call.method,
      headers: call.headers,
      body: call.body,
      redirect: 'manual',
    })
  } catch {
    // The upstream address is private in production, so keep it out of the
    // message the browser sees.
    throw new ApiUnreachableError()
  }
}

/**
 * The API's `{ error }` shape, so the client reads a proxy refusal just like an
 * API one.
 */
function apiError(status: number, error: string): Response {
  return Response.json(
    { error },
    { status, headers: { 'Cache-Control': 'private, no-store' } },
  )
}

/**
 * A response for a failure the proxy itself produced: 404 for a path that cannot
 * be mapped, 502 for an unreachable or misconfigured API (distinct from any
 * status the API chose).
 */
function proxyFailure(error: unknown): Response | null {
  if (error instanceof ProxyPathError) {
    return apiError(404, 'Not Found')
  }

  if (
    error instanceof ApiUnreachableError ||
    error instanceof ApiUpstreamConfigError
  ) {
    return apiError(502, 'Bad Gateway')
  }

  return null
}

/** `Response` refuses a body on these statuses, and the API sends none. */
function allowsBody(status: number): boolean {
  return status !== 204 && status !== 205 && status !== 304
}

/**
 * Forwards one browser request to the API and returns its answer. This is why
 * the browser never needs the API's address: request and response cross the
 * network inside this process while the page stays on its own origin.
 */
export async function forwardApiRequest(
  request: Request,
  splat: string | undefined,
): Promise<Response> {
  const safe = isSafeMethod(request.method)
  const requestOrigin = getRequestUrl().origin

  // State-changing requests only continue when the browser says they came from
  // this site. Start's CSRF middleware guards server functions, not server
  // routes, so the check lives here — before the cookie rides upstream.
  const forwardedOrigin = safe
    ? requestOrigin
    : resolveForwardedOrigin(request.headers, requestOrigin)

  if (forwardedOrigin === null) {
    return apiError(403, 'Forbidden')
  }

  let body: ArrayBuffer | null

  try {
    body = safe ? null : await readBoundedBody(request, MAX_REQUEST_BODY_BYTES)
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return apiError(413, 'Payload Too Large')
    }

    throw error
  }

  let upstream: Response

  try {
    upstream = await callUpstream({
      method: request.method,
      splat,
      search: new URL(request.url).search,
      headers: buildUpstreamRequestHeaders(request, forwardedOrigin),
      body,
    })
  } catch (error) {
    const failure = proxyFailure(error)

    if (failure !== null) {
      return failure
    }

    throw error
  }

  return new Response(allowsBody(upstream.status) ? upstream.body : null, {
    status: upstream.status,
    headers: buildProxyResponseHeaders(upstream.headers),
  })
}

interface UserEnvelope {
  user: SessionUser
}

/**
 * The signed-in account for the request being handled, or `null` when the API
 * says there is no session. The cookie is read from the incoming request, so the
 * answer arrives with the page. Only a definite 401 means signed out: anything
 * else throws, because treating an outage as "signed out" would show a signed-in
 * visitor a login form.
 */
export async function getCurrentUserFromRequest(): Promise<SessionUser | null> {
  const cookie = getRequestHeader('cookie')

  const upstream = await callUpstream({
    method: 'GET',
    splat: 'auth/me',
    search: '',
    headers:
      cookie === undefined ? new Headers() : new Headers({ Cookie: cookie }),
    body: null,
  })

  if (upstream.status === 401) {
    return null
  }

  if (!upstream.ok) {
    throw new Error(
      `The API answered the session lookup with ${upstream.status}`,
    )
  }

  const { user } = (await upstream.json()) as UserEnvelope

  return user
}
