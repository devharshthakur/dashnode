# Development setup

## Run locally

You will need Node.js `>= 24`, pnpm `12.5.1`, and Docker Desktop for the included MongoDB setup. If you already have MongoDB, it must run as a replica set because post and tag writes use transactions.

Install the workspace dependencies from the repository root:

```bash
pnpm install
```

Copy the API's example environment file and replace its placeholder `JWT_SECRET` with a private value of at least 32 characters. You can generate one with `openssl rand -base64 32`. The example already allows the web development server at `http://localhost:5173`.

```bash
cp apps/api/.env.example apps/api/.env
```

The local environment file is ignored by Git. Never commit real secrets.

Start the local database and then the apps:

```bash
pnpm --filter api db:up
pnpm dev
```

The database command also initializes the replica set. The web app runs at `http://localhost:5173`; the API listens at `http://localhost:8000`. The web app forwards the browser's `/api/*` requests to the API, so check it either directly or through the web app:

```bash
curl http://localhost:8000/health
curl http://localhost:5173/api/health
```

The second one is what the browser uses. The forwarding target is configured with `API_UPSTREAM_URL` (see `apps/web/.env.example`), which the web server reads on its own; left unset, it defaults to `http://localhost:8000`, which is correct for local development.

When you are finished, stop the database:

```bash
pnpm --filter api db:down
```

Other useful commands:

| Command                     | What it does                                              |
| --------------------------- | --------------------------------------------------------- |
| `pnpm build`                | Builds the workspace applications.                        |
| `pnpm test`                 | Runs the API and web test suites.                         |
| `pnpm validate`             | Runs lint, formatting, type checks, and both test suites. |
| `pnpm --filter api db:logs` | Follows the local MongoDB logs.                           |

## Run the tests

The API test suite needs none of the above. `pnpm test` starts its own in-memory MongoDB replica set, so it runs without Docker, without `pnpm --filter api db:up`, and without an `apps/api/.env`. The web suite is pure and needs neither a server nor a database:

```bash
pnpm test
```

One thing to know about a fresh clone: `pnpm install` downloads a `mongod` binary for [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server), around 80 MB. That is the only step that needs network access, and a failure to fetch it is the most common reason a new clone cannot run the tests. The binary is cached, so later runs are offline. Behind a proxy, set `MONGOMS_DOWNLOAD_MIRROR` to a mirror you can reach.

## Deployment plan

The project is not deployed yet. Once the MVP works locally, the current plan is to host the web app on [Vercel](https://vercel.com), the API on [Railway](https://railway.com), and use a managed MongoDB replica set from MongoDB Atlas or Railway.

For the web app, use the Vercel deployment preset and build with `pnpm --filter web build`. For the API, build with `pnpm --filter api build` and start the compiled server with `pnpm --filter api start`.

Vercel and Railway are different origins, so both services must use HTTPS. The browser never reaches the API directly, though: it asks the web app at `/api/*`, and that server forwards to the API over the network configured in `API_UPSTREAM_URL`. Set production values in the hosting providers, not in the repository:

- The API needs `NODE_ENV=production`, `MONGO_URI`, `CORS_ORIGIN`, `LOG_LEVEL`, and a private `JWT_SECRET` of at least 32 characters.
- The web app needs `API_UPSTREAM_URL` set to the API's **private** address — an internal hostname or a private service address, not a public URL. Only the web server needs to reach the API, so this is what lets the API be taken off the public internet once the proxy is deployed.
- The web app needs no public configuration: nothing about the API is exposed to the browser, so there is no `VITE_`-prefixed variable for it.

Before disabling direct access to the API, confirm the two services can actually reach each other. If they are on hosting platforms with no private networking between them, either add it or move them somewhere that has it; otherwise the proxy will answer `502` and the app will appear broken for signed-in and signed-out visitors alike.

`CORS_ORIGIN` still matters. It is what the API's `requireTrustedOrigin` compares state-changing requests against, and the proxy forwards the public web origin on the API's behalf. Removing the browser's cross-origin requests does not remove that check, so keep `CORS_ORIGIN` set to the exact deployed web origin.

Roll this out in order: deploy the proxy, verify login, logout, `/api/health`, and a protected read through the web origin, and only then restrict ingress to the API. Rolling back means restoring direct browser access; no database or token change is involved, but visitors signed in before the move are signed out once, because their old cookie belongs to the API's host and JavaScript cannot move it.
