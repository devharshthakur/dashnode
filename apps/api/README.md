# API

The Express 5 service behind DashNode. It owns request validation, authentication, authorization, post/tag/profile logic, and all MongoDB access, and it is the only place those rules are enforced. Routers are mounted at the server root, and every document leaves through a DTO mapper in `src/utils/`.

Markdown is stored verbatim and never rendered here — rendering belongs to the client.

## Layout

| Path               | Contents                                                                  |
| ------------------ | ------------------------------------------------------------------------- |
| `src/routes/`      | HTTP surface: validate, delegate, map domain errors to statuses           |
| `src/schemas/`     | Zod request and environment schemas                                       |
| `src/services/`    | Business logic and Mongoose access                                        |
| `src/models/`      | Mongoose models                                                           |
| `src/middlewares/` | `requireAuth`, `requireTrustedOrigin`, error and not-found handlers       |
| `src/utils/`       | Session signing, slug and cursor helpers, transaction helper, DTO mappers |
| `src/errors/`      | Domain error classes                                                      |
| `src/test/`        | Test harness, factories, and Vitest projects                              |

Internal imports use the `#*` aliases declared in `package.json`. Each layer depends only on the one below it, so a request reads as route → schema → service → model → mapper.

## Endpoints

Items follow the [REST API requirements](../../PRD.md#5-rest-api-specification). Checked items are implemented; `/health` is an addition.

| Method   | Path                | Notes                                                                      |
| -------- | ------------------- | -------------------------------------------------------------------------- |
| `GET`    | `/health`           | Liveness check.                                                            |
| `POST`   | `/auth/register`    | Creates an account and starts a session. `409` if the email is taken.      |
| `POST`   | `/auth/login`       | Verifies credentials and starts a session. `401` when they do not match.   |
| `GET`    | `/auth/me`          | The signed-in account. Requires a session.                                 |
| `POST`   | `/auth/logout`      | Revokes the current session, clears its cookie. Requires a trusted origin. |
| `GET`    | `/posts`            | Published posts, newest first. Supports `search` and `tag`.                |
| `POST`   | `/posts`            | Creates a draft or published post. Session + trusted origin.               |
| `GET`    | `/posts/:slug`      | One published post, by slug.                                               |
| `PUT`    | `/posts/:id`        | Updates the author's own post. Session + trusted origin.                   |
| `DELETE` | `/posts/:id`        | Deletes the author's own post. Session + trusted origin.                   |
| `GET`    | `/posts/mine/list`  | The signed-in user's drafts and published posts, newest first.             |
| `GET`    | `/posts/mine/:id`   | One of the signed-in user's posts, body included.                          |
| `GET`    | `/tags`             | Tags used by published posts, with a post count each.                      |
| `GET`    | `/tags/:slug/posts` | Published posts for one tag.                                               |
| `GET`    | `/users/:id`        | Public profile plus one page of its published posts.                       |
| `PUT`    | `/users/me`         | Updates the signed-in profile. Session + trusted origin.                   |

Public post queries always filter `status: 'published'`, so drafts never leak; ownership is checked in the service (`loadOwnedPost`) before any mutation; and user responses omit the password hash.

## Behavior worth knowing

**Sessions.** A session is a signed JWT (`jose`) in the HttpOnly `token` cookie, valid for 7 days and revocable one at a time through `models/revoked-token.ts`. `401 Unauthorized` means the session itself was rejected — no cookie, a token that fails verification, a revoked token, or a user that no longer exists. Session verification reads from MongoDB, so a failure there is a server fault and surfaces as `500`: a client can treat `401` as proof the session ended and retry after a `500` instead of discarding a cookie that is still valid.

**Write routes check the origin.** A browser attaches the session cookie to any request it is told to send, including a form POST from another site, so every route that writes for the signed-in user (`POST /posts`, `PUT`/`DELETE /posts/:id`, `PUT /users/me`, `POST /auth/logout`) requires `Origin` to be one of the `CORS_ORIGIN` entries. CORS alone is not enough: it stops a foreign page from reading the response, not from triggering the write. A request that declares no origin is refused with `403`, so non-browser clients must send the header themselves. Read-only routes are unaffected.

**Passwords are limited in bytes.** bcrypt folds only the first 72 **bytes** of a password into its hash and ignores the rest, so registration requires at least 8 characters and at most 72 bytes as UTF-8, and login enforces the same ceiling. Counting bytes matters: 37 `é` characters are 74 bytes and would hash exactly like their first 36 characters. A longer password is answered with `400 Validation Error` rather than silently shortened, so two visibly different passwords can never share a hash. Accounts created before the limit may hold a hash of a password that can no longer be submitted, and need a new password.

**Lists are keyset-paginated.** 10 posts per page by default, at most 50 via `limit`. Each response carries an opaque `nextCursor`; send it back as `cursor` and treat `null` as the end. Paging is over the ordering key plus `_id` — `publishedAt` descending for public feeds, `createdAt` descending for the dashboard — so it does not slow down with depth and ties stay stable. List queries project card fields only, so a page never reads a stored Markdown body; detail endpoints load those.

**Published feeds order by `publishedAt`**, stamped when a post is first published (or republished after being unpublished) and left unchanged by later edits.

**Slug races never fail a request.** A slug is derived from the title and chosen before it is stored, so two concurrent `POST /posts` calls for the same new title can pick the same one. Only a duplicate on the `slug` index is retried: the request takes a different slug and writes again, so both posts are stored (`title`, `title-1`) and neither request becomes a `5xx`. After losing more than one race it stops competing for a readable slug and appends a random token (`title-a7f3c19e02`). Any other database failure is left to the generic `500`.

**The tag directory follows published posts.** `GET /tags` lists only tags at least one published post uses, so a tag coined while drafting is invisible until a post carrying it is published — a zero count is never returned, which would leak a draft's tag name. The tag document is not deleted when it drops out of the directory, so republishing brings it back with its new count and a tag left unused can be reused by name. No separate cleanup is needed.

**Image fields are validated as URLs.** A post's `coverImage` and a profile's `avatarUrl` are the only references to media this service does not host, so each accepts an absolute `http`/`https` URL of at most 2048 characters, or an empty string to clear it. Anything else — `not-a-url`, a relative or protocol-relative path, `javascript:`, `data:`, `file:` — is answered with `400 Validation Error` rather than stored and handed back as an image source. Records written before this rule keep being served.

**`PUT /users/me` is partial.** It takes any subset of `name`, `bio`, `avatarUrl` and sets only the fields the request carried, so changing a bio does not mean resending the name. A body with none of them is `400 Validation Error` rather than a no-op success, and the response uses the same user shape as register and login.

**Request bodies are JSON, capped at 1 MB.** Malformed JSON is `400 Bad Request`, an oversized body `413 Payload Too Large`, an unsupported charset or content encoding `415 Unsupported Media Type`; each carries only that status message. Everything else that throws becomes a generic `500 Internal Server Error` with no stack trace. So `400` on a write is always a request to fix and resend, never a transient condition to retry.

## Configuration

`src/env.ts` validates the environment at startup and exits on failure. The file a run reads is chosen by `NODE_ENV`: `.env.test` for tests, `.env` for development and for a local production run, and a deployment relies on the values its platform injects, which are never overwritten.

| Variable          | Required | Purpose                                           |
| ----------------- | -------- | ------------------------------------------------- |
| `JWT_SECRET`      | yes      | Signs session JWTs, at least 32 characters        |
| `MONGO_URI`       | no       | Connection string; defaults to the local database |
| `PORT`            | no       | Defaults to `8000`                                |
| `CORS_ORIGIN`     | no       | Comma-separated origins allowed to call the API   |
| `LOG_LEVEL`       | no       | pino level; `info` by default                     |
| `HTTP_TIMEOUT_MS` | no       | Timeout for the shared outbound client            |
| `HTTP_BASE_URL`   | no       | Base URL for that client                          |

```bash
cp apps/api/.env.example apps/api/.env   # then set JWT_SECRET: openssl rand -base64 32
pnpm --filter api db:up                 # MongoDB as a single-node replica set
pnpm --filter api dev                   # http://localhost:8000
```

MongoDB must be a replica set, because post and tag writes run in transactions. `pnpm --filter api build` bundles with tsdown to `build/index.mjs`, which `pnpm --filter api start` runs. See [development setup](../../SETUP.md) for the full picture.

## Testing

[Vitest](https://vitest.dev), with every test file next to the source it covers (`src/services/post.test.ts` for `src/services/post.ts`). `pnpm test` needs no `db:up`, no Docker, and no `.env` — the only requirement is network access on the first install, which downloads a `mongod` binary.

The suite runs as two projects listed in `src/test/projects.ts`: **pure** (schemas, pure utilities, environment parsing, the origin middleware) touches no database, and **database** starts one **in-memory MongoDB replica set** for the whole run (`src/test/global-setup.ts`; `src/test/setup.ts` connects Mongoose, builds the unique indexes, and empties collections between tests). A replica set rather than a plain in-memory server because transactions are only allowed on a replica set member. A committed `.env.test` supplies a throwaway signing secret, and `src/test/env-setup.ts` validates the effective environment with the same schema the server uses before any test runs — a shell override wins over the file, so an invalid one fails the gate rather than surfacing inside a worker.

Write tests through `src/test/`:

| Helper                                      | What it gives you                                                            |
| ------------------------------------------- | ---------------------------------------------------------------------------- |
| `api()`                                     | the whole app from `App()`, for one request, with no port bound              |
| `registeredSession()` / `loggedInSession()` | a `supertest` agent that keeps its cookie, plus the raw token for a replay   |
| `trustedOrigin()`                           | the `Origin` a state-changing request needs                                  |
| `createUser` / `createPost` / `createTag`   | documents with unique emails and slugs, so a test cannot collide with itself |

A test that opens its own connection, or that stubs the session cookie, is testing something other than what ships. `pnpm validate` from the repository root runs this suite alongside lint, formatting, and type checks. There is no coverage threshold: the suite pins behavior — ownership enforcement, draft isolation, the slug retry, the `401`-versus-`500` split — and a threshold taken from a measurement would only pass by accident.
