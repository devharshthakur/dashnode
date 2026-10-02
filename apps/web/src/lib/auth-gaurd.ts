import { redirect } from '@tanstack/react-router'
import type { SessionUser } from '#/lib/session'
import { createServerFn } from '@tanstack/react-start'

// The guard reads the session through the server, on every evaluation, rather
// than from a cached client query. That is what keeps both directions agreeing:
// a render on the server and a navigation in the browser ask the same question of
// the same source, and neither can answer it from a stale value.
//
// A guard is a user-experience aid, not the authorization boundary. The API
// verifies the session cookie and refuses the request itself on every protected
// endpoint, so a bypassed redirect reveals nothing.
//
// A failure to reach the API is left to throw in either mode: it is not evidence
// about the session, so the route shows its error rather than a redirect that
// would send a signed-in visitor to a login form they do not need, or a
// signed-out one into a page they cannot load.

/**
 * Guards a route in one of two directions, reading the session once per
 * evaluation.
 *
 * `'auth'` keeps a signed-out visitor out of a protected route, and hands the
 * verified user to the page so it never has to ask again. `'guest'` keeps a
 * signed-in visitor out of a guest-only route. The user is `null` in that
 * direction, because the route must be usable by a signed-out visitor.
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
 * The signed-in account as the API reports it for the request being handled:
 * the user, or `null` when there is no session.
 *
 * Route guards call this instead of the browser, so a decision is made on the
 * server from the session cookie the request already carries. That is what lets
 * a signed-out visitor be turned away from a protected page before any of it is
 * rendered, and it keeps the cookie and the API's address out of the data the
 * router sends to the browser.
 *
 * The upstream module is loaded inside the handler rather than at module scope.
 * The compiler replaces this definition with a client-side fetcher, so a
 * top-level import of a `.server.ts` module would be left behind in the browser
 * bundle and rejected by Start's import protection.
 */
export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const { getCurrentUserFromRequest } =
      await import('#/lib/server/api-upstream.server')

    return getCurrentUserFromRequest()
  },
)
