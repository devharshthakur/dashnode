import type { NextFunction, Request, Response } from 'express'

import { getUserById, isTokenRevoked } from '#services/auth'
import {
  AUTH_COOKIE_NAME,
  verifySessionToken,
  type VerifiedSession,
} from '#utils/auth'

/**
 * Rejects the request unless it carries a valid session cookie that has not
 * been blacklisted and whose user still exists. On success it attaches the safe
 * user to `req.user`.
 *
 * Only a session this middleware can positively disprove is answered with
 * `401`. The database reads a valid session needs can fail on their own, and a
 * failure there says nothing about the session, so it is passed to the error
 * handler as a `500`: clients treat `401` as "log me out" and would otherwise
 * discard a cookie that is still good once the database recovers.
 *
 * Every protected route must use this middleware: route guards in the web app
 * are user-experience aids, not an authorization boundary.
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
