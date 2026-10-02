import { redirect } from '@tanstack/react-router'

import { getCurrentUserFn } from '#/lib/current-user'

import type { SessionUser } from '#/lib/session'

// Both guards read the session through the server, on every evaluation, rather
// than from a cached client query. That is what keeps them agreeing with each
// other: a render on the server and a navigation in the browser ask the same
// question of the same source, and neither can answer it from a stale value.
//
// A guard is a user-experience aid, not the authorization boundary. The API
// verifies the session cookie and refuses the request itself on every protected
// endpoint, so a bypassed redirect reveals nothing.

/**
 * Keeps a signed-in visitor out of a guest-only route.
 *
 * A failure to reach the API is left to throw: it is not evidence that the
 * visitor is signed out, and sending someone to a login form they do not need
 * loses whatever they had typed.
 */
export async function requireGuest(): Promise<void> {
  const user = await getCurrentUserFn()

  if (user) {
    throw redirect({ to: '/', replace: true })
  }
}

/**
 * Keeps a signed-out visitor out of a protected route, and hands the verified
 * user to the page so it never has to ask again.
 *
 * Only a definite absence of a session redirects. An outage throws instead, and
 * the route shows its error rather than protected content.
 */
export async function requireAuth(): Promise<{ user: SessionUser }> {
  const user = await getCurrentUserFn()

  if (!user) {
    throw redirect({ to: '/login', replace: true })
  }

  return { user }
}
