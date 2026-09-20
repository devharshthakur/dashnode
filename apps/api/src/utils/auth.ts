import type { Response } from 'express'
import { SignJWT } from 'jose'

import { env } from '#env'

export const AUTH_COOKIE_NAME = 'token'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

const secret = new TextEncoder().encode(env.JWT_SECRET)

/**
 * Signs a short-lived session JWT whose subject is the user id. The token is
 * meant to travel in the HttpOnly auth cookie, never in application state.
 */
export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret)
}

/**
 * Sets the session cookie.
 *
 * Production is cross-site (Vercel web -> Railway API), which requires
 * `SameSite=None; Secure`. Local development runs over HTTP on the same site,
 * so `lax` keeps the cookie working without HTTPS.
 */
export function setAuthCookie(res: Response, token: string): void {
  const isProduction = env.NODE_ENV === 'production'

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: '/',
  })
}
