# Web app

The browser-facing application lives here. At present, its only route (`/`) renders a sample Markdown article; it is not yet connected to the API.

Start the web app from the repository root:

```bash
pnpm --filter web dev
```

Routes are in `src/routes/`, and shared UI and Markdown components are in `src/components/`. See the [development setup](../../SETUP.md) and [architecture overview](../../ARCHITECTURE.md).
