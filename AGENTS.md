This file provides guidance to AI coding agents like Claude Code (claude.ai/code), Cursor AI, Codex, Gemini CLI, GitHub Copilot, and other AI coding assistants when working with code in this repository.

# Hashnode Clone

pnpm + Turborepo monorepo with `apps/web` (TanStack Start/React; not yet connected to the API), `apps/api` (Express 5 + Mongoose), and shared/config packages. The API owns validation, authentication, and data access.

## Validation

- Run `pnpm validate` from the repository root after edits; it runs `turbo run lint check typecheck` across packages. It is the only standard validation command — do not run individual lint, formatting, or typecheck commands, or builds, unless the user explicitly requests them. Resolve any failures before reporting completion.
- There is no test runner and no test file in the repository. Do not invent test commands or claim tests passed; `pnpm validate` is the gate.
- The Husky pre-commit hook runs `lint-staged`, which only applies Prettier to changed files.

## Commands

Node >= 24 (`.nvmrc` pins 24.21.0) and pnpm 12.5.1 (`packageManager`, with `engineStrict`) are required.

- `pnpm install` — install workspace dependencies.
- `cp apps/api/.env.example apps/api/.env` — first run; then set `JWT_SECRET` to a private value of 32+ characters (`openssl rand -base64 32`).
- `pnpm --filter api db:up` — start local MongoDB (single-node replica set). It must be running before the API, and it must stay a replica set because post/tag writes use transactions.
- `pnpm dev` — run all apps: web at `http://localhost:5173`, API at `http://localhost:3001`.
- `pnpm --filter api dev` / `pnpm --filter web dev` — run one app; both start without a prior build.
- `pnpm build` — build all apps (API via tsdown to `apps/api/build/`, web via Vite).
- `pnpm --filter api start` — run the compiled API (`apps/api/build/index.mjs`).
- `pnpm --filter web generate-routes` — regenerate `apps/web/src/routeTree.gen.ts` after adding or removing route files.
- `pnpm --filter api db:down` / `db:logs` — stop MongoDB / follow its logs.

Verify a running API with `curl http://localhost:3001/api/health`.

## Task → starting path

- **API endpoint**: route in `apps/api/src/routes/` (routers mount in `routes/index.ts` under the `/api` prefix from `config/constants.ts`), Zod request schema in `src/schemas/`, logic in `src/services/`, model in `src/models/`. Map Mongoose documents through the DTO mappers in `src/utils/` (see `utils/post.ts`); throw domain error classes from `src/errors/` and map them to status codes in the route — `middlewares/error.ts` is only the generic 500 fallback.
- **Protected route**: add `requireAuth` from `src/middlewares/auth.ts`; it verifies the session cookie and sets `req.user`. Web route guards are UX only, never the authorization boundary.
- **Session/auth changes**: `src/utils/auth.ts` (sign, verify, cookie) and `src/services/auth.ts` (register, login, revocation).
- **Shared wire types**: `packages/shared/src/` (package `@packages/shared`) — types only, no runtime validation; consumed by the API, not yet by the web app.
- **Web page/UI**: file-based routes in `apps/web/src/routes/`; `#/` aliases `apps/web/src/`. shadcn components live in `src/components/ui/` (aliases and style in `apps/web/components.json`, theme in `src/styles.css`). `src/components/ui/**` and `src/routeTree.gen.ts` are ESLint-ignored.
- **Endpoint docs**: check the endpoint off in `apps/api/README.md`; the commit history pairs features with a `docs(api)` update.
- **Environment/config**: `apps/api/src/env.ts` validates config at startup and exits on failure — add new keys to both that schema and `apps/api/.env.example`.
- **Docker/Mongo behavior**: `apps/api/compose.yml` (replica-set init) and `src/config/db.ts`.

## Architecture and conventions

- API request flow: route → Zod validation → service → Mongoose model → DTO mapper; internal imports use the `#*` aliases declared in `apps/api/package.json`.
- Public post queries always filter `status: 'published'`; ownership is checked in services (`loadOwnedPost`) before mutations. Post and tag writes run inside `withTransaction`, which is why local MongoDB must be a replica set.
- The API stores Markdown verbatim and never renders it; rendering belongs to the client.
- Sessions are signed JWTs (jose) in HttpOnly cookies, revocable via `models/revoked-token.ts`.
- Apps do not import each other's source; cross-app contracts belong in `packages/shared`.
- Commits follow Conventional Commits with a package scope (`feat(api): …`, `chore(config): …`), and merge commits reference `issue/#<n>` branches.

## Docs

- [SETUP.md](./SETUP.md) — local setup, commands, deployment plan.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — structure and data flow; its endpoint list is behind the code, so trust `apps/api/README.md` for what exists.
- [PRD.md](./PRD.md) — product requirements and the full API specification.
- Per-app READMEs: `apps/api/README.md` (current endpoint checklist), `apps/web/README.md`, `packages/shared/README.md`.
- `.agents/skills/` — project-local skills for shadcn UI, `@shadcn/lint`, tsdown, and Turborepo when working in those areas.
