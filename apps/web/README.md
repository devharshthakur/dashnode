# Web app

The browser-facing application lives here: a DashNode landing page with login and signup, plus the signed-in dashboard.

| Route        | Purpose                                                                            |
| ------------ | ---------------------------------------------------------------------------------- |
| `/`          | DashNode landing page. Shows Login and Sign up, or Go to dashboard when signed in. |
| `/login`     | Signs in through `POST /api/auth/login`.                                           |
| `/signup`    | Creates an account through `POST /api/auth/register`.                              |
| `/dashboard` | App shell with a sidebar, the published feed, and a composer that creates a post.  |
| `/api/*`     | Server route that forwards each request to the API. Not a page.                    |

## Talking to the API

The browser only ever talks to this application, at `/api/*`. A Start server route — `src/routes/api/$.ts` — forwards each of those requests to Express, so the API's address never reaches the client bundle and the browser never makes a cross-origin request. `apps/api` mounts its routers at the server root, which is why `/api/auth/me` here is `/auth/me` there.

`API_UPSTREAM_URL` names the API origin that server route forwards to, and only the server reads it (see `apps/web/.env.example`). Locally it defaults to `http://localhost:8000`; in production it points at a private address only this server can reach, which is why the API can then be kept off the public internet. The proxy's own decisions — path mapping, the origin check on state-changing methods, which headers cross the network — live with the forwarding itself in `src/lib/server/api-upstream.server.ts`, covered by the tests next to it. That is the only server module behind the route, so the rules read as one list; the route file is a delegate.

Two consequences worth knowing:

- **Cookies.** The API's `token` cookie is host-only, so a browser stores it for the web host once the proxy relays it, with its `HttpOnly`, `Secure`, `SameSite`, `Path`, and expiry attributes unchanged. Because `/api/*` is this application's own origin, the browser attaches that cookie to every request it makes there by itself — no JavaScript reads or sets it — and the proxy relays it upstream unchanged. Visitors whose session predates the move are signed out of the web app once, because their old cookie belongs to the API's host and JavaScript cannot transfer it.
- **Origin.** The proxy refuses any state-changing request whose `Origin` is not this site's, before it reaches the API, and forwards the public origin so the API's own `requireTrustedOrigin` check still applies. Removing browser CORS does not remove the need for that.

## Sessions

The session is a signed JWT in an HttpOnly cookie, so JavaScript cannot read it. `GET /api/auth/me` reports the current account, which `src/lib/session.ts` both wraps in a TanStack Query hook and exposes to the server as `getCurrentUser`.

One guard (`src/lib/auth-gaurd.ts`, used as `authGaurd('auth')` or `authGaurd('guest')` in `beforeLoad`) reads that account on every evaluation, rather than from a cached client query — so a signed-out visitor is redirected away from `/dashboard` before any of it is rendered, and a signed-in one is redirected away from `/login` and `/signup`. Only a definite `401` counts as signed out; an outage raises an error instead, because treating it as "signed out" would greet a signed-in visitor with a login form. The guard is a user-experience aid only — the API verifies the session cookie and refuses the request itself on every protected endpoint.

Start the web app from the repository root:

```bash
pnpm --filter web dev
```

Routes are in `src/routes/`, shared UI in `src/components/` (shadcn components in `src/components/ui/`), and the API client and session hooks in `src/lib/`. `pnpm --filter web test` runs the suite covering the proxy's decisions. See the [development setup](../../SETUP.md) and [architecture overview](../../ARCHITECTURE.md).
