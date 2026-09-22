import type { CookieOptions, Response } from 'express'
import { SignJWT, jwtVerify } from 'jose'

import { env } from '#env'

export const AUTH_COOKIE_NAME = 'token'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

const secret = new TextEncoder().encode(env.JWT_SECRET)

/**
 * Cookie attributes shared by set and clear. They must match exactly, otherwise
 * the browser treats the cleared cookie as a different one.
 */
function authCookieOptions(): CookieOptions {
  const isProduction = env.NODE_ENV === 'production'

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  }
}

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
 * Verifies a session JWT and returns its subject (the user id).
 *
 * Throws when the token is malformed, expired, has an invalid signature, or
 * carries no subject. Callers translate that into an unauthenticated response.
 */
export async function verifySessionToken(token: string): Promise<string> {
  const { payload } = await jwtVerify(token, secret)

  if (!payload.sub) {
    throw new Error('Session token is missing a subject')
  }

  return payload.sub
}

/**
 * Sets the session cookie.
 */
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...authCookieOptions(),
    maxAge: SESSION_TTL_SECONDS * 1000,
  })
}

/**
 * Clears the session cookie so the browser stops sending it. Logout has to
 * happen server-side because an HttpOnly cookie is invisible to JavaScript.
 */
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions())
}
