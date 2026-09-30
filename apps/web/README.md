# Web app

The browser-facing application lives here: a DashNode landing page with login and signup, plus a small dashboard.

| Route        | Purpose                                                                                   |
| ------------ | ----------------------------------------------------------------------------------------- |
| `/`          | DashNode landing page. Shows Login and Sign up, or Go to dashboard when a session exists. |
| `/login`     | Signs in through `POST /api/auth/login`.                                                  |
| `/signup`    | Creates an account through `POST /api/auth/register`.                                     |
| `/dashboard` | The signed-in user's landing spot, with logout.                                           |

The session is a signed JWT in an HttpOnly cookie, so JavaScript cannot read it. The conditional account actions come from `GET /api/auth/me`, which `src/lib/session.ts` wraps in a TanStack Query hook; a `401` means "signed out". The guard on `/dashboard` is a user-experience aid only — the API authorizes every protected request.

The browser calls the API directly with credentials, and the client defaults to `http://localhost:3001/api`. Set `VITE_API_URL` in `apps/web/.env` to point at another API; that origin must also appear in the API's `CORS_ORIGIN`.

Start the web app from the repository root:

```bash
pnpm --filter web dev
```

Routes are in `src/routes/`, shared UI in `src/components/` (shadcn components in `src/components/ui/`), and the API client and session hooks in `src/lib/`. See the [development setup](../../SETUP.md) and [architecture overview](../../ARCHITECTURE.md).
