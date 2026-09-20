import { Router } from 'express'

export const authRouter = Router()

authRouter.post('/register', (_req, res) => {
  res.status(501).json({ error: 'Not Implemented' })
})

authRouter.post('/login', (_req, res) => {
  res.status(501).json({ error: 'Not Implemented' })
})

authRouter.get('/me', (_req, res) => {
  res.status(501).json({ error: 'Not Implemented' })
})
