import type { NextFunction, Request, Response } from 'express'

import { corsOrigins } from '#config/cors'

/** Value browsers send for an opaque origin, e.g. a sandboxed frame or a local file. */
const OPAQUE_ORIGIN = 'null'

/**
 * Resolves the origin the browser says the request came from, or `null` when
 * the request declares none.
 *
 * `Origin` is the authoritative header and browsers always set it on unsafe
 * methods, so it decides the outcome on its own — including the opaque
 * `null` value, which no legitimate page in this app has. `Referer` is only a
 * fallback for the rare request that arrives without `Origin`.
 */
function declaredOrigin(req: Request): string | null {
  const origin = req.get('origin')

  if (origin !== undefined) {
    return origin === OPAQUE_ORIGIN ? null : origin
  }

  const referer = req.get('referer')

  if (referer === undefined) {
    return null
  }

  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}

/**
 * Rejects a state-changing request unless it comes from a whitelisted web app.
 *
 * The session cookie rides along on every request the browser makes, including
 * ones a foreign page triggers, so possession of the cookie proves nothing about
 * who asked. CORS does not help here: it keeps the foreign page from *reading*
 * the response, but the request is still sent and still executed. Requiring the
 * request's own declared origin to be one of ours is the part a cross-site form
 * POST cannot forge.
 *
 * A request that declares no origin is rejected too. Browsers always send
 * `Origin` on POST, PUT and DELETE, so its absence means a non-browser client,
 * and the session cookie is a browser mechanism this API has no other use for.
 * Callers that need to reach these endpoints without a browser must send an
 * `Origin` header themselves.
 *
 * Every route that changes data on behalf of the signed-in user must use this
 * middleware alongside `requireAuth`; read-only routes do not need it.
 */
export function requireTrustedOrigin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const origin = declaredOrigin(req)

  if (origin === null || !corsOrigins.includes(origin)) {
    req.log.warn({ origin }, 'Request rejected: untrusted origin')
    res.status(403).json({ error: 'Forbidden' })
    return
  }

  next()
}
