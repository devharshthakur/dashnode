import { Router } from 'express'

import { requireAuth } from '#middlewares/auth'
import { loginBodySchema, registerBodySchema } from '#schemas/auth'
import {
  EmailTakenError,
  InvalidCredentialsError,
  loginUser,
  registerUser,
} from '#services/auth'
import { clearAuthCookie, setAuthCookie, signSessionToken } from '#utils/auth'

export const authRouter = Router()

authRouter.post('/register', async (req, res, next) => {
  const parsed = registerBodySchema.safeParse(req.body)

  if (!parsed.success) {
    res.status(400).json({
      error: 'Validation Error',
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
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
    res.status(400).json({
      error: 'Validation Error',
      details: parsed.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
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

authRouter.get('/me', requireAuth, (req, res) => {
  res.status(200).json({ user: req.user })
})

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.status(200).json({ message: 'Logged out' })
})
