# API

This Express service owns authentication, request validation, post operations, and MongoDB access. Its routes are prefixed with `/api`.

## API checklist

Items follow the [REST API requirements](../../PRD.md#5-rest-api-specification). Checked items are implemented; the health check is an additional endpoint.

### Health

- [x] `GET /api/health`

### Authentication

- [x] `POST /api/auth/register` — create an account and start a session.
- [x] `POST /api/auth/login` — verify credentials and start a session.
- [x] `GET /api/auth/me` — return the signed-in user's account data.
- [x] `POST /api/auth/logout` — revoke the current session and clear its cookie; requires a request from a whitelisted web origin.

### Posts

- [x] `GET /api/posts` — list published posts, one bounded page at a time; supports title search and tag filtering.
- [x] `GET /api/posts/:slug` — return a published post by slug.
- [x] `POST /api/posts` — create a draft or published post; two requests for the same new title both succeed, on `title` and `title-1`.
- [x] `PUT /api/posts/:id` — update the author's own post.
- [x] `DELETE /api/posts/:id` — delete the author's own post.
- [x] `GET /api/posts/mine/list` — list the signed-in user's drafts and published posts, one bounded page at a time.
- [x] `GET /api/posts/mine/:id` — return one of the signed-in user's posts, including its Markdown body.

### Tags and users

- [x] `GET /api/tags` — list tags on published posts, with counts of the published posts using each tag.
- [x] `GET /api/tags/:slug/posts` — list published posts for a tag, one bounded page at a time.
- [x] `GET /api/users/:id` — return a public profile and one bounded page of its published posts.
- [x] `PUT /api/users/me` — update the signed-in user's profile; every field is optional, so one can be sent on its own.

Unlike the PRD's bearer-token flow, this API sends signed JWTs in HttpOnly cookies. Protected routes verify the session; public post results exclude drafts, update and delete enforce ownership on the server, and user responses omit password hashes. Routes, validation schemas, services, and models are organized under `src/`.

Passwords are hashed with bcrypt, which only folds the first 72 **bytes** of a password into its hash and ignores the rest. Registration therefore requires at least 8 characters and at most 72 bytes when encoded as UTF-8, and login enforces the same 72-byte ceiling. Counting bytes rather than characters matters because a multibyte password can pass a 72-character limit and still overflow bcrypt's: 37 `é` characters are 74 bytes, and bcrypt would hash it exactly like its first 36 characters. Both endpoints answer `400 Validation Error` for a longer password rather than shortening it silently, so two visibly different passwords can never share one hash. Accounts created before this limit accepted a multibyte password that exceeded it hold a hash of that password's first 72 bytes; such a password can no longer be submitted, so those accounts need a new password.

Protected routes answer `401 Unauthorized` only when the session itself is rejected: no cookie, a token that fails verification, a token revoked by logout, or a user that no longer exists. Session verification also reads from MongoDB, and a database failure there is a server fault, so it surfaces as `500 Internal Server Error` instead. Clients can therefore treat `401` as proof the session ended and retry after a `500`, rather than discarding a cookie that is still valid.

Because a browser attaches the session cookie to any request it is told to send — including a form POST from another site — every route that writes on behalf of the signed-in user (`POST /api/posts`, `PUT /api/posts/:id`, `DELETE /api/posts/:id`, `PUT /api/users/me`, and `POST /api/auth/logout`) first checks that the request's `Origin` header is one of the `CORS_ORIGIN` entries. CORS alone is not enough: it stops a foreign site from reading the response, but not from triggering the write. A request that declares no origin is rejected with `403`, so non-browser clients calling these endpoints must send an `Origin` header themselves. Read-only routes are unaffected.

`GET /api/tags` lists only tags that at least one **published** post uses, so a tag coined while writing a draft — such as `secret-project` — is not visible to a visitor until a post carrying it is published. A count of `0` is therefore not part of a response, unlike the PRD's "all available tags": showing a zero-count tag would leak a draft's tag name through the public directory. The tag document is not deleted when it drops out of the directory, so publishing the draft later brings the tag back with the count it now has, and a tag left unused by retagging or deleting its only post can be reused by name instead of being created twice. Because the directory is derived from published posts rather than read from the tag collection, it follows those transitions by itself: a draft's tag appears when the post is published and disappears when the post is unpublished, with no separate cleanup.

Public feeds order posts by `publishedAt`, which is stamped when a post is first published (or republished after being unpublished) and left unchanged by later edits.

A post's slug is derived from its title and must be unique, and choosing one is a separate step from storing it, so two concurrent `POST /api/posts` requests for the same new title can pick the same slug. The unique index on `slug` is the final protection, and a request it rejects simply takes a different slug and writes again, so a lost race never fails the request and never becomes a `5xx`: both posts are stored, under `title` and `title-1`. Once a request has lost more than one race it stops competing for a readable slug and appends a random token to the title instead (`title-a7f3c19e02`), which no concurrent request can be holding. Only a duplicate on the slug index is handled this way; any other database failure is left to the generic `500`, so a server fault is still reported as one.

Image fields — a post's `coverImage` and a profile's `avatarUrl` — are the API's only references to media it does not host, so both accept an absolute `http` or `https` URL of at most 2048 characters, or an empty string to clear the image. A value that is not a URL at all (`not-a-url`), a relative or protocol-relative path, or another scheme (`javascript:`, `data:`, `file:`) is answered with `400 Validation Error` instead of being stored and handed back to a client as an image source. Existing records are not re-validated: a URL stored before this rule keeps being served, and the client renders it as an image link or nothing.

`PUT /api/users/me` takes any subset of `name`, `bio`, and `avatarUrl`, and sets only the fields the request carried, so changing a bio does not require resending the name and avatar. A body with none of them is answered with `400 Validation Error` rather than a no-op success. Responses come from the same user shape as registration and login, which never includes the password hash.

Request bodies are parsed as JSON and capped at 1 MB. A body the parser refuses is the client's mistake, not a server fault: malformed JSON gets `400 Bad Request`, a body over the limit gets `413 Payload Too Large`, and an unsupported charset or content encoding gets `415 Unsupported Media Type`. Each response carries only that status message. Anything else that throws is answered with a generic `500 Internal Server Error` and no stack trace, so an unexpected failure never leaks internals. `400` on a write is therefore always a request the client should fix and resend, never a transient condition to retry.

Every endpoint that lists posts returns a bounded page: 10 posts by default and at most 50 per request through `limit`. Each response carries an opaque `nextCursor`; send it back as `cursor` to read the next page, and treat `null` as the end of the list. Lists are keyset-paginated over their ordering key plus `_id` (`publishedAt` descending for public feeds, `createdAt` descending for the dashboard), so paging does not slow down with depth and ties keep a stable order. The queries also project only card fields, so a page never reads stored Markdown bodies; post bodies are loaded by the detail endpoints only.

To run the API locally, configure its environment and start MongoDB as described in the [development setup](../../SETUP.md), then run `pnpm --filter api dev` from the repository root.

## Testing

The suite is [Vitest](https://vitest.dev). It lives in `apps/api`, and every test file sits next to the source it covers (`src/services/post.test.ts` for `src/services/post.ts`).

```bash
pnpm test                                  # once
pnpm test:watch                            # re-runs on change
pnpm --filter api test:coverage            # with a coverage report
```

Nothing has to be set up first. `pnpm test` needs no `pnpm --filter api db:up`, no Docker, and no `apps/api/.env` — `src/test/global-setup.ts` starts one **in-memory MongoDB replica set** for the whole run and stops it afterwards, and `src/test/setup.ts` connects Mongoose, builds the unique indexes before the first test, and empties the collections between tests. A replica set rather than a plain in-memory server because post and tag writes run in transactions, which MongoDB only allows on a replica set member.

The suite reads a committed `apps/api/.env.test`, which supplies a throwaway signing secret and keeps `pino` out of the test report. Before any test file runs, `src/test/env-setup.ts` loads that file and validates it with the same Zod schema the server uses, so a missing file or a value the schema rejects stops the run with nothing executed. A variable exported by the shell or CI keeps its value: the file only fills in what is unset.

The only requirement is network access on the first run: `pnpm install` downloads a `mongod` binary. It is cached from then on.

Write tests through the helpers in `src/test/`:

| Helper                                      | What it gives you                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `api()`                                     | the whole app from `App()`, for one request — no port bound                                   |
| `registeredSession()` / `loggedInSession()` | a `supertest` agent that keeps its session cookie, plus the raw token for a deliberate replay |
| `trustedOrigin()`                           | the `Origin` value every state-changing request needs                                         |
| `createUser` / `createPost` / `createTag`   | documents with unique emails and slugs, so a test never collides with itself                  |

A test file that opens its own connection, or that stubs the session cookie, is testing something other than what ships. `pnpm validate` from the repository root runs the suite alongside lint, formatting, and type checks.

There is no coverage threshold. The suite is here to pin behavior — ownership enforcement, draft isolation, the slug retry, the `401`-versus-`500` split — and a threshold set from the current measurement would only pass by accident.
