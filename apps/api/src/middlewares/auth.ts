import type { NextFunction, Request, Response } from 'express'

import { getUserById } from '#services/auth'
import { AUTH_COOKIE_NAME, verifySessionToken } from '#utils/auth'

/**
 * Rejects the request unless it carries a valid session cookie whose user still
 * exists. On success it attaches the safe user to `req.user`.
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
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const userId = await verifySessionToken(token)
    const user = await getUserById(userId)

    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}
