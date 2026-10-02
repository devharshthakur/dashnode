import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

// The web app's own suite, which covers the decisions the `/api/*` server route
// makes before anything reaches the network. Nothing here starts a server or a
// database: the proxy's rules are pure functions, and the forwarding around them
// is exercised against a stubbed `fetch`.
export default defineConfig({
  resolve: {
    alias: {
      '#': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
