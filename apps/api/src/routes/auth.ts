import { Router } from 'express'

import { EmailTakenError, InvalidCredentialsError } from '#errors/auth'
import { sendValidationError } from '#errors/route'
import { requireAuth } from '#middlewares/auth'
import { requireTrustedOrigin } from '#middlewares/origin'
import { loginBodySchema, registerBodySchema } from '#schemas/auth'
import { loginUser, registerUser, revokeToken } from '#services/auth'
import {
  AUTH_COOKIE_NAME,
  clearAuthCookie,
  setAuthCookie,
  signSessionToken,
  verifySessionToken,
  type VerifiedSession,
} from '#utils/auth'

export const authRouter = Router()

authRouter.post('/register', async (req, res, next) => {
  const parsed = registerBodySchema.safeParse(req.body)

  if (!parsed.success) {
    sendValidationError(res, parsed.error)
    return
  }

  try {
    const user = await registerUser(parsed.data)
    const token = await signSessionToken(user.id)

    setAuthCookie(res, token)
    res.status(201).json({ user })
  } catch (error) {
    if (error instanceof EmailTakenError) {
      res.status(409).json({ error: error.message })
      return
    }

    next(error)
  }
})

authRouter.post('/login', async (req, res, next) => {
  const parsed = loginBodySchema.safeParse(req.body)

  if (!parsed.success) {
    sendValidationError(res, parsed.error)
    return
  }

  try {
    const user = await loginUser(parsed.data)
    const token = await signSessionToken(user.id)

    setAuthCookie(res, token)
    res.status(200).json({ user })
  } catch (error) {
    if (error instanceof InvalidCredentialsError) {
      res.status(401).json({ error: error.message })
      return
    }

    next(error)
  }
})

authRouter.post('/logout', requireTrustedOrigin, async (req, res, next) => {
  const token: unknown = req.cookies?.[AUTH_COOKIE_NAME]
  let session: VerifiedSession | null = null

  if (typeof token === 'string' && token.length > 0) {
    try {
      session = await verifySessionToken(token)
    } catch {
      // Invalid or expired token: nothing left to revoke.
      session = null
    }
  }

  try {
    if (session) {
      await revokeToken(session.jti, session.expiresAt)
    }

    clearAuthCookie(res)
    res.status(200).json({ message: 'Logged out' })
  } catch (error) {
    // Token is not revoked yet: keep the cookie so logout can be retried.
    next(error)
  }
})

authRouter.get('/me', requireAuth, (req, res) => {
  res.status(200).json({ user: req.user })
})
