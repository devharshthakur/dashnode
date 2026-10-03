import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

// The web suite covers the `/api/*` route's decisions before anything reaches
// the network. Nothing here starts a server or database: the proxy rules are
// pure functions, and forwarding is exercised against a stubbed `fetch`.
export default defineConfig({
  resolve: {
    alias: {
      '#': fileURLToPath(new URL('./src', import.meta.url)),
      '#lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
