import { getRequestHeader, getRequestUrl } from '@tanstack/react-start/server'

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
  toUpstreamPathname,
} from '#/lib/server/api-proxy'

import type { SessionUser } from '#/lib/session'

// The `.server.ts` name is what keeps this module out of the browser bundle:
// Start's import protection rejects any client-side import of a file that
// matches `*.server.*`. Nothing here may reach the client — it holds the API's
// address, which is private in production.

/** The API could not be reached, or is configured with an address that cannot serve it. */
class ApiUnreachableError extends Error {
  constructor() {
    super('The API is unreachable')
    this.name = 'ApiUnreachableError'
  }
}

interface UpstreamCall {
  method: string
  /** Path below the API's own root, as it arrived after the `/api/` prefix. */
  splat: string | undefined
  search: string
  headers: Headers
  body: ArrayBuffer | null
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
