import type { NextFunction, Request, Response } from 'express'

import { getUserById, isTokenRevoked } from '#services/auth'
import {
  AUTH_COOKIE_NAME,
  verifySessionToken,
  type VerifiedSession,
} from '#utils/auth'

// A `401` from here tells the client its session is gone, and clients act on
// that by logging out and throwing the cookie away. A database failure must not
// look like that, so it travels to the error handler as a `500` and leaves the
// cookie in place for when the database recovers.
//
// Every protected route must use this middleware: route guards in the web app
// are user-experience aids, not an authorization boundary.

/**
 * Attaches the safe user to `req.user`, or answers `401` unless the request
 * carries a valid session cookie that has not been blacklisted and whose user
 * still exists. A failed session lookup is passed to the error handler as a
 * `500` rather than refused.
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token: unknown = req.cookies?.[AUTH_COOKIE_NAME]

  if (typeof token !== 'string' || token.length === 0) {
    req.log.debug('Request rejected: no session cookie')
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  let session: VerifiedSession

  try {
    session = await verifySessionToken(token)
  } catch (error) {
    req.log.warn({ err: error }, 'Request rejected: invalid session token')
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { userId, jti } = session

  try {
    if (await isTokenRevoked(jti)) {
      req.log.warn({ jti }, 'Request rejected: session token was revoked')
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    const user = await getUserById(userId)

    if (!user) {
      req.log.warn({ userId }, 'Request rejected: user no longer exists')
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    req.user = user
    next()
  } catch (error) {
    // Both reads above are MongoDB queries. Anything they throw is a fault on
    // this side of the connection, not a rejected session.
    req.log.error({ err: error }, 'Request failed: session lookup error')
    next(error)
  }
}
