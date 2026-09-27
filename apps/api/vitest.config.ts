import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'build/**'],
    // `globals` stays off so test files import `describe` / `it` / `expect`
    // explicitly, the same way the source imports what it uses.
    setupFiles: ['src/test/setup.ts'],
    // Vitest sets `NODE_ENV=test` before any setup file runs, and that is what
    // makes `src/env.ts` load `.env.test`.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
    },
  },
})
