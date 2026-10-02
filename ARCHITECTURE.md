# Architecture

The repository contains a web application, a REST API, and shared workspace packages. The API owns application rules and database access; the browser should never connect directly to MongoDB.

The backend already handles health checks, authentication, and post operations. The web app currently renders a sample Markdown page and does not yet call the API.

## Project structure

```text
.
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── config/         Database, CORS, logging, HTTP client
│   │   │   ├── errors/         Request and domain errors
│   │   │   ├── middlewares/    Authentication and error handling
│   │   │   ├── models/         User, Post, Tag, RevokedToken
│   │   │   ├── routes/         HTTP endpoints
│   │   │   ├── schemas/        Request validation
│   │   │   ├── services/       Authentication and post operations
│   │   │   ├── types/          Express request types
│   │   │   ├── utils/          Cookies, slugs, transactions, DTOs
│   │   │   ├── app.ts          Express middleware and route setup
│   │   │   ├── env.ts          Validated API configuration
│   │   │   └── index.ts        Database and server lifecycle
│   │   └── compose.yml         Local MongoDB replica set
│   └── web/
│       └── src/
│           ├── components/     Markdown display and UI primitives
│           ├── integrations/   TanStack Query setup
│           ├── routes/         Root document and home page
│           ├── router.tsx
│           └── styles.css
├── packages/
│   ├── eslint-config/
│   ├── prettier-config/
│   ├── shared/                 API request and response types
│   └── typescript-config/
├── package.json               Workspace commands
├── pnpm-workspace.yaml
└── turbo.json                 Task pipeline
```

## Technology choices

| Area      | Technology                                                           | Role                                               |
| --------- | -------------------------------------------------------------------- | -------------------------------------------------- |
| Web       | TanStack Start, React, TanStack Router, TanStack Query, Tailwind CSS | Rendering, routes, server-state setup, and styling |
| API       | Node.js, Express, TypeScript, Zod                                    | REST endpoints and request validation              |
| Data      | MongoDB and Mongoose                                                 | Document storage and data models                   |
| Markdown  | `@tanstack/markdown`                                                 | Rendering Markdown in the web app                  |
| Workspace | pnpm and Turborepo                                                   | Managing packages and running project tasks        |

## How requests and data flow

In the intended application flow, the browser loads pages from the web app, which requests JSON from the API. The API validates requests, applies authentication and ownership rules, calls service functions, and reads or writes MongoDB through Mongoose. At present, the web app is not yet connected to that API.

The API entry point (`apps/api/src/index.ts`) connects to MongoDB and starts the server. Its application setup (`apps/api/src/app.ts`) installs logging, credentialed CORS, JSON and cookie parsing, routes, and error handlers. Routes use Zod schemas for request validation; services handle operations such as post ownership and linking tags. Models define users, posts, tags, and revoked sessions.

The shared package contains TypeScript request and response types. It is used by the API; the web app does not yet consume these types or make API requests.

## API available today

| Route                                     | Access         | Purpose                                                |
| ----------------------------------------- | -------------- | ------------------------------------------------------ |
| `GET /health`                             | Public         | Check that the API is running.                         |
| `POST /auth/register`, `POST /auth/login` | Public         | Create an account or start a session.                  |
| `POST /auth/logout`                       | Cookie-based   | Revoke the current session and clear its cookie.       |
| `GET /auth/me`                            | Signed-in user | Return the current user's public account data.         |
| `GET /posts`                              | Public         | List published posts; supports search and tag filters. |
| `POST /posts`                             | Signed-in user | Create a post.                                         |
| `PUT /posts/:id`, `DELETE /posts/:id`     | Post owner     | Edit or delete one of the user's posts.                |

Sessions use signed JWTs in HttpOnly cookies. The API verifies protected requests and checks post ownership before allowing changes. Public post queries return published posts only; tags are created or linked when a post is written.

## Work still to do

The web app needs its publishing pages and API integration. The API does not yet provide post-detail reads, profile endpoints, or dedicated tag endpoints. See [Setup](./SETUP.md) to run the project and [PRD](./PRD.md) for the full product requirements.
