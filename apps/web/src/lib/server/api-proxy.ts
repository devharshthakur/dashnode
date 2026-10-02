/**
 * The decisions the `/api/*` server route makes when it forwards a browser
 * request to the Express API.
 *
 * Nothing here reads the environment, performs I/O, or reaches into a runtime
 * request object, so every rule the proxy enforces can be read — and tested —
 * on its own. `api-upstream.server.ts` supplies the runtime pieces and calls
 * into these.
 */

/** Path the browser calls; the API mounts its routers at the server root. */
export const API_PROXY_PREFIX = '/api'

/** Environment variable naming the API origin this server forwards to. */
export const API_UPSTREAM_ENV_VAR = 'API_UPSTREAM_URL'

/** Used when nothing is configured, so local development needs no `.env`. */
export const DEFAULT_API_UPSTREAM_URL = 'http://localhost:8000'

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
