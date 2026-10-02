import { getRequestHeader, getRequestUrl } from '@tanstack/react-start/server'

import type { SessionUser } from '#/lib/session'

// The `.server.ts` name is what keeps this module out of the browser bundle:
// Start's import protection rejects any client-side import of a file that
// matches `*.server.*`. Nothing here may reach the client — it holds the API's
// address, which is private in production.
//
// It is one file on purpose. The browser reaches the API through the catch-all
// server route in `src/routes/api/$.ts`, and everything that decides what that
// route forwards lives here: the upstream address, the path mapping, the origin
// check on writes, which headers cross the network, and how the answer comes
// back. The route file stays a thin delegate, so the rules below can be read as
// one list instead of followed across a second module.

/** Environment variable naming the API origin this server forwards to. */
export const API_UPSTREAM_ENV_VAR = 'API_UPSTREAM_URL'

/** Used when nothing is configured, so local development needs no `.env`. */
const DEFAULT_API_UPSTREAM_URL = 'http://localhost:8000'

/**
 * Largest body the proxy will forward, matching `bodyParser.json({ limit: '1mb' })`
 * in `apps/api/src/app.ts`. Refusing it here means a request Express would have
 * rejected never gets buffered in this process first.
 */
export const MAX_REQUEST_BODY_BYTES = 1_048_576

/** Value browsers send for an opaque origin, e.g. a sandboxed frame. */
const OPAQUE_ORIGIN = 'null'

/**
 * Hop-by-hop headers (RFC 9110 §7.6.1). They describe the one connection a
 * header travels over, so a proxy drops them instead of passing them along.
 */
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
 * Request headers the proxy must not relay.
 *
 * `host` and the forwarding headers describe the hop that delivered the request
 * rather than the visitor, and copying them would let a caller tell the API
 * something different from what it told Start. `content-length` describes the
 * framing of the original body, which `fetch` computes again once the proxy has
 * decided what to forward.
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
 * Response headers worth passing through.
 *
 * `content-encoding` and `content-length` are absent on purpose: `fetch` has
 * already decoded the body, so neither describes what goes on the wire any more.
 * `cache-control` is absent because the proxy states its own policy below, and
 * the upstream's CORS headers are absent because the browser is talking to this
 * application, not to the API.
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
 * Every path the API exposes is built from ordinary URL segments: router names,
 * `mine`, `list`, slugs, and ObjectIds. Anything outside this set cannot name an
 * endpoint, so refusing it is both simpler and safer than escaping a string that
 * might carry `..`, a backslash, or a percent-encoded `?`.
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
 * Reads and checks the API origin this server forwards to.
 *
 * Only an origin is accepted. A path would be silently dropped by the mapping in
 * {@link toUpstreamPathname}, credentials would travel to the API in clear text,
 * and a query or fragment would look like configuration when it is not.
 *
 * Development falls back to the address `pnpm dev` serves the API on. Production
 * refuses an unset value rather than assuming one: a wrong guess would either
 * point the proxy at a public host nobody audited or quietly send every request
 * nowhere, and the failure is much easier to read when it is reported.
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
 * Maps the file-route splat onto the API's own path: a request for
 * `/api/auth/me` carries the splat `auth/me` and becomes `/auth/me` upstream,
 * because Express mounts its routers at the server root.
 *
 * Checking every segment is what keeps this a fixed translation. The result can
 * only be a sequence of plain segments, so it cannot walk out of the API, smuggle
 * a query string into the path, or reach any origin but the configured one.
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
 * Methods a cross-site page can trigger without a preflight, and so the only
 * ones that need no origin check.
 *
 * `HEAD` is safe because nothing about a request body makes the others
 * dangerous: the API mounts no `HEAD` route and Start answers it with the `GET`
 * handler, dropping the body.
 */
export function isSafeMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD'
}

/**
 * The origin to send upstream for a state-changing request, or `null` when the
 * request must not be forwarded at all.
 *
 * Browsers always send `Origin` on an unsafe method, so a missing one means the
 * caller is not a page of this application. The opaque `null` is what a
 * sandboxed frame or a local file sends, and no page here has one. In both cases
 * the request says nothing about who asked, and the session cookie rides along
 * regardless — so the answer is to refuse, not to guess.
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
 * The headers to send upstream: everything the browser sent except what a proxy
 * must not relay, with the public origin in place of the caller's.
 *
 * The session cookie is part of "everything the browser sent" and rides along
 * without any help from the client: a same-origin `/api/*` request carries it on
 * its own, because JavaScript cannot read an HttpOnly cookie.
 *
 * Express checks the origin on its own state-changing routes against an allowlist
 * that names the deployed web origin, so the value that reaches the API has to be
 * the public one. Forwarding the browser's copy would leave the API unable to
 * distinguish a write from this site from one that merely claims to be.
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
 * Rewrites one `Set-Cookie` so the browser stores it for the web host.
 *
 * The API sets its session cookie host-only, and a cookie that arrives through
 * this proxy is stored for whichever host served the response. A `Domain`
 * attribute naming the API's own host would make the browser reject it, so it is
 * dropped; every other attribute — `HttpOnly`, `Secure`, `SameSite`, `Path`, and
 * expiry — is left exactly as the API wrote it.
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
 * Cookies as separate values. `Headers.get` folds several `Set-Cookie` lines
 * into one comma-joined string, which a browser cannot split back apart again;
 * runtimes that cannot list them individually get the single-line case, which is
 * all a one-cookie response needs.
 */
function getSetCookieValues(upstream: Headers): string[] {
  if (typeof upstream.getSetCookie === 'function') {
    return upstream.getSetCookie()
  }

  const combined = upstream.get('set-cookie')

  return combined === null ? [] : [combined]
}

/**
 * The headers to answer the browser with: the upstream's own content type and
 * metadata, each session cookie on its own `Set-Cookie` line, and a caching
 * policy that keeps personalized answers out of shared caches.
 */
export function buildProxyResponseHeaders(upstream: Headers): Headers {
  const headers = new Headers()

  for (const name of RESPONSE_HEADERS_TO_PASS) {
    const value = upstream.get(name)

    if (value !== null) {
      headers.set(name, value)
    }
  }

  // Anything under `/api/*` can depend on the caller's session, and during this
  // migration that includes the public reads, so no answer here may be stored.
  headers.set('Cache-Control', 'private, no-store')

  for (const cookie of getSetCookieValues(upstream)) {
    headers.append('Set-Cookie', stripCookieDomain(cookie))
  }

  return headers
}

/**
 * Reads the body, refusing anything over the limit.
 *
 * `Content-Length` is a claim rather than a promise, so the chunks are counted
 * as they arrive: a request that lies about its length, or omits the header
 * altogether, still cannot make this process hold more than the API would have
 * accepted.
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
 * Reads the API origin to forward to.
 *
 * Per request, not at module scope: edge SSR runtimes only populate the
 * environment while a request is being handled, so a module-level read would
 * freeze `undefined` into the bundle and every request would fail the same way.
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
    // `manual` because following a redirect would let the API steer this process
    // at an address of its choosing. No endpoint here redirects, so nothing is
    // lost by refusing to follow one.
    return await fetch(target, {
      method: call.method,
      headers: call.headers,
      body: call.body,
      redirect: 'manual',
    })
  } catch {
    // The upstream address is private in production, so it stays out of the
    // message the browser eventually sees.
    throw new ApiUnreachableError()
  }
}

/**
 * The API's own failure shape, so the browser's API client reads a refusal from
 * the proxy exactly as it reads one from the API. Never cached.
 */
function apiError(status: number, error: string): Response {
  return Response.json(
    { error },
    { status, headers: { 'Cache-Control': 'private, no-store' } },
  )
}

/**
 * The answer for a failure the proxy itself produced. A path that cannot be
 * mapped is a `404` because no endpoint exists for it, while an API that cannot
 * be reached is a `502` — distinct from any status the API chose for itself.
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
 * Forwards one browser request to the API and returns its answer.
 *
 * This is the whole reason the browser never needs the API's address: the
 * request and the response cross the network inside this process, while the page
 * keeps talking to its own origin.
 */
export async function forwardApiRequest(
  request: Request,
  splat: string | undefined,
): Promise<Response> {
  const safe = isSafeMethod(request.method)
  const requestOrigin = getRequestUrl().origin

  // A state-changing request may only continue when the browser says it came from
  // this application. Start's own CSRF middleware guards server functions, not
  // server routes, so this check has to happen here — before the request reaches
  // the API, and before the session cookie rides along with it.
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
 * says there is no session.
 *
 * The cookie is read from the incoming request rather than from the browser, so
 * the answer arrives with the page instead of the page asking for it again. Only
 * a definite `401` means signed out: an outage, or any other status, throws. A
 * guard that read that as "signed out" would greet a signed-in visitor with a
 * login form, which is both wrong and harder to tell apart from a real session
 * ending.
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
