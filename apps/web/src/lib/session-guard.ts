import { redirect } from '@tanstack/react-router'

import { sessionQueryOptions } from '#/lib/session'

import type { QueryClient } from '@tanstack/react-query'

interface GuestContext {
  context: { queryClient: QueryClient }
}

/**
 * Keeps a signed-in visitor out of a guest-only route. Fails open when the API
 * cannot be reached: a guard is a user-experience aid, not an authorization
 * boundary, and the API still verifies the session cookie on every request.
 */
export async function requireGuest({ context }: GuestContext) {
  const user = await context.queryClient
    .query({ ...sessionQueryOptions, staleTime: 'static' })
    .catch(() => null)

  if (user) {
    throw redirect({ to: '/', replace: true })
  }
}
