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
- [x] `POST /api/posts` — create a draft or published post.
- [x] `PUT /api/posts/:id` — update the author's own post.
- [x] `DELETE /api/posts/:id` — delete the author's own post.
- [x] `GET /api/posts/mine/list` — list the signed-in user's drafts and published posts, one bounded page at a time.
- [x] `GET /api/posts/mine/:id` — return one of the signed-in user's posts, including its Markdown body.

### Tags and users

- [x] `GET /api/tags` — list tags with counts of published posts using each tag.
- [x] `GET /api/tags/:slug/posts` — list published posts for a tag, one bounded page at a time.
- [x] `GET /api/users/:id` — return a public profile and one bounded page of its published posts.
- [x] `PUT /api/users/me` — update the signed-in user's profile.

Unlike the PRD's bearer-token flow, this API sends signed JWTs in HttpOnly cookies. Protected routes verify the session; public post results exclude drafts, update and delete enforce ownership on the server, and user responses omit password hashes. Routes, validation schemas, services, and models are organized under `src/`.

Passwords are hashed with bcrypt, which only folds the first 72 **bytes** of a password into its hash and ignores the rest. Registration therefore requires at least 8 characters and at most 72 bytes when encoded as UTF-8, and login enforces the same 72-byte ceiling. Counting bytes rather than characters matters because a multibyte password can pass a 72-character limit and still overflow bcrypt's: 37 `é` characters are 74 bytes, and bcrypt would hash it exactly like its first 36 characters. Both endpoints answer `400 Validation Error` for a longer password rather than shortening it silently, so two visibly different passwords can never share one hash. Accounts created before this limit accepted a multibyte password that exceeded it hold a hash of that password's first 72 bytes; such a password can no longer be submitted, so those accounts need a new password.

Protected routes answer `401 Unauthorized` only when the session itself is rejected: no cookie, a token that fails verification, a token revoked by logout, or a user that no longer exists. Session verification also reads from MongoDB, and a database failure there is a server fault, so it surfaces as `500 Internal Server Error` instead. Clients can therefore treat `401` as proof the session ended and retry after a `500`, rather than discarding a cookie that is still valid.

Because a browser attaches the session cookie to any request it is told to send — including a form POST from another site — every route that writes on behalf of the signed-in user (`POST /api/posts`, `PUT /api/posts/:id`, `DELETE /api/posts/:id`, `PUT /api/users/me`, and `POST /api/auth/logout`) first checks that the request's `Origin` header is one of the `CORS_ORIGIN` entries. CORS alone is not enough: it stops a foreign site from reading the response, but not from triggering the write. A request that declares no origin is rejected with `403`, so non-browser clients calling these endpoints must send an `Origin` header themselves. Read-only routes are unaffected.

Public feeds order posts by `publishedAt`, which is stamped when a post is first published (or republished after being unpublished) and left unchanged by later edits.

Request bodies are parsed as JSON and capped at 1 MB. A body the parser refuses is the client's mistake, not a server fault: malformed JSON gets `400 Bad Request`, a body over the limit gets `413 Payload Too Large`, and an unsupported charset or content encoding gets `415 Unsupported Media Type`. Each response carries only that status message. Anything else that throws is answered with a generic `500 Internal Server Error` and no stack trace, so an unexpected failure never leaks internals. `400` on a write is therefore always a request the client should fix and resend, never a transient condition to retry.

Every endpoint that lists posts returns a bounded page: 10 posts by default and at most 50 per request through `limit`. Each response carries an opaque `nextCursor`; send it back as `cursor` to read the next page, and treat `null` as the end of the list. Lists are keyset-paginated over their ordering key plus `_id` (`publishedAt` descending for public feeds, `createdAt` descending for the dashboard), so paging does not slow down with depth and ties keep a stable order. The queries also project only card fields, so a page never reads stored Markdown bodies; post bodies are loaded by the detail endpoints only.

To run the API locally, configure its environment and start MongoDB as described in the [development setup](../../SETUP.md), then run `pnpm --filter api dev` from the repository root.
