import type { SafeUser } from '#services/auth'

declare global {
  namespace Express {
    interface Request {
      /** Set by the `requireAuth` middleware on protected routes. */
      user?: SafeUser
    }
  }
}

export {}
