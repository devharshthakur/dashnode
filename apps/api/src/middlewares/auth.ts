import type { NextFunction, Request, Response } from 'express'

import { getUserById, isTokenRevoked } from '#services/auth'
import { AUTH_COOKIE_NAME, verifySessionToken } from '#utils/auth'

/**
 * Rejects the request unless it carries a valid session cookie that has not
 * been blacklisted and whose user still exists. On success it attaches the safe
 * user to `req.user`.
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

  try {
    const { userId, jti } = await verifySessionToken(token)

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
    // Same response as the other rejection branches; only log the reason.
    req.log.warn({ err: error }, 'Request rejected: invalid session token')
    res.status(401).json({ error: 'Unauthorized' })
  }
}
