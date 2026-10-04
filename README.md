# DashNode

DashNode is an independent internship project exploring a publishing platform for developers. Authors can write Markdown articles, save drafts, add tags, and publish posts. Readers can browse and search a public feed.

## Current status

The API already supports authentication and core post operations. The web app is still a starter page that displays sample Markdown; it is not connected to the API, so the complete publishing experience is not available yet.

## Design decisions

The original requirements describe a [Vite](https://vite.dev/) and [React](https://react.dev/) single-page app with a JavaScript [Express](https://expressjs.com/) backend. This project instead uses [TanStack Start](https://tanstack.com/start/latest) for a server-capable web app and Express for the REST API; both are written in [TypeScript](https://www.typescriptlang.org/). The web app handles presentation, while the API owns validation, authentication, authorization, and data access.

The web and API live in one monorepo managed by [pnpm](https://pnpm.io/). Shared API types live in the [shared package](./packages/shared/README.md); the applications do not import each other's source.

## Documentation

1.  [Setup](./SETUP.md) explains local development and the deployment plan.
2.  [Architecture](./ARCHITECTURE.md) describes the project structure, technology choices, API, and current gaps.
3.  [Web app](./apps/web/README.md) describes the frontend and how to run it.
4.  [API](./apps/api/README.md) describes the service and its available endpoints.
5.  [Shared](./packages/shared/README.md) describes the types used by the API and web app.
6.  [Product requirements Document](./PRD.md) contains the MVP scope and API contract.
7.  [Original requirements](./PRD.pdf) is the supplied source document.

## License

MIT. See [LICENSE](./LICENSE).
