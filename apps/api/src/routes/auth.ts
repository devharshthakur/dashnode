import { Router } from 'express'

import { registerBodySchema } from '#schemas/auth'
import { EmailTakenError, registerUser } from '#services/auth'
import { setAuthCookie, signSessionToken } from '#utils/auth'

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

authRouter.post('/login', (_req, res) => {
  res.status(501).json({ error: 'Not Implemented' })
})

authRouter.get('/me', (_req, res) => {
  res.status(501).json({ error: 'Not Implemented' })
})
