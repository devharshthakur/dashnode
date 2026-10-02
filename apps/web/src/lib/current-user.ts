import { createServerFn } from '@tanstack/react-start'

import type { SessionUser } from '#/lib/session'

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
export const getCurrentUserFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SessionUser | null> => {
    const { getCurrentUserFromRequest } =
      await import('#/lib/server/api-upstream.server')

    return getCurrentUserFromRequest()
  },
)
