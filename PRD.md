# Hashnode Clone — Product Requirements

> [!NOTE]
> Agent-ready reference derived from [`PRD.pdf`](./PRD.pdf). The PDF remains the source document; this file is the implementation context.

## Product summary

Build a developer-first blogging and publishing platform. Visitors browse published technical articles, filter them by tags, search titles, and view author profiles. Registered users manage a profile and create, save, edit, publish, and delete their own Markdown posts.

## MVP requirements

### Authentication and authorization

- Register with name, email, and password.
- Log in and remain authenticated after a refresh; log out clears the session.
- Hash passwords with `bcryptjs`; never store or expose plaintext passwords.
- Require a valid JWT for protected client routes and API endpoints.
- Enforce post ownership on the server: only the post author may update or delete it.

### Posts

- Create posts with a title, raw Markdown content, cover-image URL, one or more tags, and a `draft` or `published` status.
- Render Markdown safely, including headings, emphasis, links, lists, and fenced code blocks with language-aware syntax highlighting.
- Generate readable unique slugs from titles.
- Support author-owned create, read, update, delete, draft, and publish workflows.
- Record author, creation time, and update time for every post.
- Show only published posts in public feeds, tag pages, post detail pages, and public profiles.

### Tags and discovery

- Allow authors to select existing tags or create tags while writing.
- Provide a tag listing with published-post counts.
- Filter the public feed by tag.
- Show a newest-first public feed with title, excerpt, cover image, author, publication date, and tags.
- Search published post titles by keyword.

### Profiles and dashboard

- Expose a public author profile with name, bio, and published posts.
- Let users update their display name, bio, and avatar URL.
- Provide a private dashboard listing the current user’s drafts and published posts with edit/delete actions.

## Stretch goals

- [ ] Likes/reactions
- [ ] Threaded comments
- [ ] Reading-time estimates
- [ ] Follow/unfollow and a personalized feed
- [ ] Pagination or infinite scrolling
- [ ] Cloudinary-style image upload
- [ ] Persisted dark mode
- [ ] Bookmarks

## Required data model

| Collection | Required fields                                                                                                                                                            |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`     | `name`, unique lowercase `email`, password hash, `bio` (max 200 chars), `avatarUrl`, timestamps                                                                            |
| `Post`     | `title`, unique `slug`, raw Markdown `content`, `excerpt` (max 250 chars), `coverImage`, `status` (`draft`/`published`), `author` reference, `tags` references, timestamps |
| `Tag`      | unique lowercase `name`, unique `slug`, timestamps                                                                                                                         |

Relationships: one user authors many posts; posts and tags have a many-to-many relationship through `Post.tags`.

## REST API contract

All protected endpoints require a valid JWT. Update/delete ownership is a server-side requirement.

| Method   | Endpoint                | Access           | Purpose                                                   |
| -------- | ----------------------- | ---------------- | --------------------------------------------------------- |
| `POST`   | `/api/auth/register`    | Public           | Register `{ name, email, password }`                      |
| `POST`   | `/api/auth/login`       | Public           | Authenticate `{ email, password }`                        |
| `GET`    | `/api/auth/me`          | Protected        | Get current user                                          |
| `GET`    | `/api/posts`            | Public           | List published posts; supports `search` and `tag` queries |
| `GET`    | `/api/posts/:slug`      | Public           | Get one published post                                    |
| `POST`   | `/api/posts`            | Protected        | Create `{ title, content, tags, coverImage, status }`     |
| `PUT`    | `/api/posts/:id`        | Protected, owner | Update a post                                             |
| `DELETE` | `/api/posts/:id`        | Protected, owner | Delete a post                                             |
| `GET`    | `/api/posts/mine`       | Protected        | List the current user’s posts, including drafts           |
| `GET`    | `/api/tags`             | Public           | List tags with post counts                                |
| `GET`    | `/api/tags/:slug/posts` | Public           | List published posts for a tag                            |
| `GET`    | `/api/users/:id`        | Public           | Get a public profile and published posts                  |
| `PUT`    | `/api/users/me`         | Protected        | Update `{ name, bio, avatarUrl }`                         |

## Application routes

| Route          | Access           | Purpose                         |
| -------------- | ---------------- | ------------------------------- |
| `/`            | Public           | Published feed and title search |
| `/post/:slug`  | Public           | Rendered post detail            |
| `/tag/:slug`   | Public           | Filtered tag feed               |
| `/login`       | Public           | Sign-in form                    |
| `/register`    | Public           | Registration form               |
| `/dashboard`   | Protected        | Current user’s posts            |
| `/editor/new`  | Protected        | Create a post                   |
| `/editor/:id`  | Protected, owner | Edit a post                     |
| `/profile/:id` | Public           | Author profile                  |
| `/settings`    | Protected        | Current user profile settings   |

## Non-negotiable pass criteria

> [!IMPORTANT]
> These four conditions are hard requirements, not preferences.

1. Password hashing works; plaintext passwords are never stored.
2. The API blocks users from modifying other users’ posts.
3. Draft posts are never publicly visible.
4. The repository runs locally by following its README.

## Evaluation focus

| Area                        | Points |
| --------------------------- | -----: |
| Authentication and security |     20 |
| Post CRUD and ownership     |     20 |
| Markdown and code rendering |     15 |
| Tags and public feed        |     15 |
| API design and code quality |     15 |
| UI/UX and responsiveness    |     10 |
| Deployment                  |      5 |

## Intentional implementation deviations

The issued PRD recommends JavaScript, Vite React SPA routing, and localStorage bearer tokens. This repository intentionally uses TypeScript, a pnpm/Turborepo monorepo, TanStack Start with TanStack Router and Query, and JWTs stored in HttpOnly cookies. These infrastructure choices do **not** change the MVP behaviours, API contract, security requirements, or grading criteria above.
