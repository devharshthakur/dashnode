import { createFileRoute } from '@tanstack/react-router'

import { forwardApiRequest } from '#/lib/server/api-upstream.server'

const ALLOWED_METHODS = 'GET, HEAD, POST, PUT, PATCH, DELETE'

/**
 * The browser's only route to the API.
 *
 * `/api/health` here is `/health` on the API, because Express mounts its routers
 * at the server root. The `api` segment exists to keep API traffic on this
 * origin and out of the router's page tree; nothing in the browser knows the
 * address it is forwarded to.
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
      // `HEAD` needs no handler of its own: Start answers it with the `GET` one
      // and drops the body.
      //
      // A cross-origin `OPTIONS` preflight cannot happen now that the browser
      // stays on this origin, and `ANY` catches every verb no handler above
      // claims. Both are refused here rather than left to fall through, so that
      // `OPTIONS /api/posts` and `TRACE /api/posts` get an API answer instead of
      // the router's HTML page.
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
