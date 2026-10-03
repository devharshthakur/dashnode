import { createFileRoute } from '@tanstack/react-router'

import { forwardApiRequest } from '#lib/server/api-upstream.server'

const ALLOWED_METHODS = 'GET, HEAD, POST, PUT, PATCH, DELETE'

/**
 * The browser's only route to the API. `/api/health` maps to `/health` on the
 * API (Express mounts at the root). The `api` segment keeps API traffic on this
 * origin and out of the page tree; the target address stays server-side.
 */
export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: ({ request, params }) => forwardApiRequest(request, params._splat),
      POST: ({ request, params }) => forwardApiRequest(request, params._splat),
      PUT: ({ request, params }) => forwardApiRequest(request, params._splat),
      PATCH: ({ request, params }) => forwardApiRequest(request, params._splat),
      DELETE: ({ request, params }) =>
        forwardApiRequest(request, params._splat),
      // `HEAD` needs no handler: Start answers it with GET and drops the body.
      // A cross-origin `OPTIONS` preflight cannot happen now, and `ANY` catches
      // every other verb. Both get an API-shaped 405 instead of the router's HTML.
      OPTIONS: methodNotAllowed,
      ANY: methodNotAllowed,
    },
  },
})

function methodNotAllowed() {
  return new Response(null, {
    status: 405,
    headers: {
      Allow: ALLOWED_METHODS,
      'Cache-Control': 'private, no-store',
    },
  })
}
