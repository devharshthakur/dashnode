import { randomUUID } from 'node:crypto'

import type { CookieOptions, Response } from 'express'
import { SignJWT, jwtVerify } from 'jose'

import { env } from '#env'

export const AUTH_COOKIE_NAME = 'token'
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

const secret = new TextEncoder().encode(env.JWT_SECRET)

// Set and clear must agree on these exactly, otherwise the browser treats the
// cleared cookie as a different one and keeps sending the original.
function authCookieOptions(): CookieOptions {
  const isProduction = env.NODE_ENV === 'production'

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  }
}

/** Verified token claims needed to authenticate and revoke a session. */
export interface VerifiedSession {
  userId: string
  /**
   * JWT ID (`jti`, RFC 7519): a unique id for this individual token, used as
   * the revocation key so one session can be logged out without touching the
   * user's other sessions.
   */
  jti: string
  expiresAt: Date
}

// The token is meant to travel in the HttpOnly auth cookie and nowhere else —
// never in application state the client could read or replay.
export async function signSessionToken(userId: string): Promise<string> {
  return new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setJti(randomUUID())
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret)
}

/**
 * Verifies a session JWT and returns its subject (the user id) plus the claims
 * needed to revoke it. Throws when the token is malformed, expired, has an
 * invalid signature, or carries no subject, id, or expiry; callers translate
 * that into an unauthenticated response.
 */
export async function verifySessionToken(
  token: string,
): Promise<VerifiedSession> {
  const { payload } = await jwtVerify(token, secret)

  if (!payload.sub) {
    throw new Error('Session token is missing a subject')
  }

  if (!payload.jti) {
    throw new Error('Session token is missing an id')
  }

  if (typeof payload.exp !== 'number') {
    throw new Error('Session token is missing an expiration')
  }

  return {
    userId: payload.sub,
    jti: payload.jti,
    expiresAt: new Date(payload.exp * 1000),
  }
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(AUTH_COOKIE_NAME, token, {
    ...authCookieOptions(),
    maxAge: SESSION_TTL_SECONDS * 1000,
  })
}

// Logout has to happen server-side because an HttpOnly cookie is invisible to
// JavaScript, so the client cannot drop the session on its own.
export function clearAuthCookie(res: Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, authCookieOptions())
}
