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

The database command also initializes the replica set. The web app runs at `http://localhost:5173`; the API listens at `http://localhost:8000`. Check the API with:

```bash
curl http://localhost:8000/api/health
```

When you are finished, stop the database:

```bash
pnpm --filter api db:down
```

Other useful commands:

| Command                     | What it does                                                |
| --------------------------- | ----------------------------------------------------------- |
| `pnpm build`                | Builds the workspace applications.                          |
| `pnpm test`                 | Runs the API test suite.                                    |
| `pnpm validate`             | Runs lint, formatting, type checks, and the API test suite. |
| `pnpm --filter api db:logs` | Follows the local MongoDB logs.                             |

## Run the tests

The API test suite needs none of the above. `pnpm test` starts its own in-memory MongoDB replica set, so it runs without Docker, without `pnpm --filter api db:up`, and without an `apps/api/.env`:

```bash
pnpm test
```

One thing to know about a fresh clone: `pnpm install` downloads a `mongod` binary for [mongodb-memory-server](https://github.com/typegoose/mongodb-memory-server), around 80 MB. That is the only step that needs network access, and a failure to fetch it is the most common reason a new clone cannot run the tests. The binary is cached, so later runs are offline. Behind a proxy, set `MONGOMS_DOWNLOAD_MIRROR` to a mirror you can reach.

## Deployment plan

The project is not deployed yet. Once the MVP works locally, the current plan is to host the web app on [Vercel](https://vercel.com), the API on [Railway](https://railway.com), and use a managed MongoDB replica set from MongoDB Atlas or Railway.

For the web app, use the Vercel deployment preset and build with `pnpm --filter web build`. For the API, build with `pnpm --filter api build` and start the compiled server with `pnpm --filter api start`.

Vercel and Railway have different origins, so both services must use HTTPS. Set the API's `CORS_ORIGIN` to the exact deployed web origin. In production, the API sets its session cookie as `HttpOnly`, `Secure`, and `SameSite=None` so browsers can send it across origins.

Set production values in the hosting providers, not in the repository. The API needs `NODE_ENV=production`, `MONGO_URI`, `CORS_ORIGIN`, `LOG_LEVEL`, and a private `JWT_SECRET` of at least 32 characters. The web app should receive only public configuration, such as an API base URL once its API client is implemented.
