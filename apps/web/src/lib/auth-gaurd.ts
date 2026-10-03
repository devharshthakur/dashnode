import { redirect } from '@tanstack/react-router'
import type { SessionUser } from '#lib/session'
import { createServerFn } from '@tanstack/react-start'

// Guards verify the session through the server on every evaluation, so a server
// render and a client navigation ask the same source and cannot answer from a
// stale value. They are UX only — the API authorizes every protected request, so
// a bypassed redirect reveals nothing. An API failure throws and the route shows
// its error, since it says nothing about whether a session exists.

/**
 * Guards a route in one direction. `'auth'` redirects signed-out visitors to
 * `/login` and returns the verified user; `'guest'` redirects signed-in visitors
 * to `/` and returns `null`, since guest routes still need to render signed-out.
 */
export async function authGaurd(
  mode: 'auth' | 'guest',
): Promise<{ user: SessionUser | null }> {
  const user = await getCurrentUser()

  if (mode === 'auth' && !user) {
    throw redirect({ to: '/login', replace: true })
  }

  if (mode === 'guest' && user) {
    throw redirect({ to: '/', replace: true })
  }

  return { user }
}

/**
 * The signed-in account as the API reports it, or `null` when there is no
 * session. Runs on the server from the request's cookie, so a guard can decide
 * before a protected page renders. The `.server` module is imported inside the
 * handler: the compiler replaces this definition with a client fetcher, and a
 * top-level server import would be left in the browser bundle and rejected.
 */
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const { getCurrentUserFromRequest } =
      await import('#lib/server/api-upstream.server')

    return getCurrentUserFromRequest()
  },
)
