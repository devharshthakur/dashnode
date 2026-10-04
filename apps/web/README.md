# Web app

DashNode's browser-facing application: a [TanStack Start](https://tanstack.com/start/latest) server-capable React app with file-based routes, Tailwind, and shadcn/ui. It renders pages and holds no business rules — the API owns validation, authentication, and data.

| Route          | Purpose                                                                       |
| -------------- | ----------------------------------------------------------------------------- |
| `/`            | Landing page. Shows Login and Sign up, or Go to dashboard when signed in.     |
| `/login`       | Signs in through `POST /api/auth/login`.                                      |
| `/signup`      | Creates an account through `POST /api/auth/register`.                         |
| `/dashboard`   | Signed-in shell: sidebar, published feed, and a composer that creates a post. |
| `/posts/$slug` | Public post detail, Markdown rendered with code highlighting.                 |
| `/api/*`       | Server route forwarding to the API. Not a page.                               |

Routes live in `src/routes/`; shared UI in `src/components/`, with shadcn components under `src/components/ui/`; data and session hooks in `src/lib/`; the query client in `src/integrations/tanstack-query/`. Adding or removing a route file needs `pnpm --filter web generate-routes` to refresh `src/routeTree.gen.ts`.

## Talking to the API

The browser only ever calls this app, at `/api/*`. The server route `src/routes/api/$.ts` forwards each of those requests to Express, so the API's address never reaches the client bundle and the browser makes no cross-origin request. Express mounts its routers at the origin root, which is why `/api/auth/me` here is `/auth/me` there.

`API_UPSTREAM_URL` names that origin and is read only on the server. It is read from `process.env` on every request rather than at module scope, because an edge SSR runtime populates the environment only while handling one and a value baked in at build time would freeze as `undefined`; `vite.config.ts` copies it from `.env` for `dev` and `preview`, and `turbo.json` passes it through the tasks' strict environment filtering. Development defaults to `http://localhost:8000`; in production an unset or non-origin value is answered with `502` rather than guessed at, because production should point at a private address only this server can reach — which is what lets the API stay off the public internet.

Everything the proxy decides lives with the forwarding in `src/lib/server/api-upstream.server.ts`, covered by the tests next to it, so the rules read as one list and the route file stays a delegate:

- **Path mapping.** The splat becomes the upstream path, with every segment checked, so a request cannot escape the origin, smuggle a query, or carry `..`. A path that cannot be mapped is `404`.
- **Origin.** Any state-changing request whose `Origin` is not this site is refused with `403` before the cookie could ride along, and a permitted one has the public origin forwarded so the API's own `requireTrustedOrigin` check still applies. Removing browser CORS does not remove the need for this.
- **Headers.** Hop-by-hop headers and those describing the delivering hop are dropped, the API's `Set-Cookie` lines are relayed one per line with any `Domain` removed so the browser stores the cookie for this host, and every answer is `Cache-Control: private, no-store` because it can depend on the caller's session.
- **Bodies.** A body over 1 MB — the API's own limit — is refused with `413` instead of being buffered, and an unreachable or misconfigured API is a `502` with no upstream address in the message.

The API's `token` cookie is host-only and HttpOnly, so JavaScript never reads or sets it; the browser attaches it to same-origin `/api/*` requests by itself. Visitors whose session predates the move to the proxy are signed out of the web app once, because their old cookie belongs to the API's host and cannot be transferred.

## Session and guards

`src/lib/session.ts` wraps `GET /api/auth/me` in a TanStack Query hook (`useSession`, with `useLogin`, `useSignup`, `useLogout` writing the same cache key) and exposes it to the server as `getCurrentUser`, which reads the cookie from the incoming request so the answer arrives with the page. `src/lib/config/axios.ts` is the single client: `apiRequest` calls `/api` and turns a non-2xx answer into an `ApiError` carrying the status, so callers branch on `status` rather than on messages.

One guard, `authGaurd('auth')` or `authGaurd('guest')` in `beforeLoad`, verifies the account through the server on every evaluation instead of a cached client query — a signed-out visitor is redirected away from `/dashboard` before any of it renders, a signed-in one away from `/login` and `/signup`, and server render and client navigation cannot disagree. Only a definite `401` counts as signed out; an API failure raises the route's error instead, because treating an outage as "signed out" would greet a signed-in visitor with a login form. The guard is a user-experience aid only — the API authorizes every protected request itself.

## Commands

```bash
pnpm --filter web dev              # http://localhost:5173
pnpm --filter web build            # production build
pnpm --filter web preview          # serve the build on :3000
pnpm --filter web generate-routes  # after adding or removing a route file
pnpm --filter web test             # suite covering the proxy's decisions
```

`pnpm --filter web test` starts no server and no database: the proxy rules are pure functions, and forwarding is exercised against a stubbed `fetch`. See [development setup](../../SETUP.md) and [architecture overview](../../ARCHITECTURE.md).
