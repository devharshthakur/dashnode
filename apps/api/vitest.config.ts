import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'build/**'],
    // `globals` stays off so test files import `describe` / `it` / `expect`
    // explicitly, the same way the source imports what it uses.
    setupFiles: ['src/test/setup.ts'],
    // The env gate runs first: a missing or invalid `.env.test` aborts the run
    // before the replica set starts and before any test file executes.
    // `global-setup.ts` then runs the one in-memory replica set the whole run
    // shares, and stops it when the run ends.
    globalSetup: ['src/test/env-setup.ts', 'src/test/global-setup.ts'],
    // Vitest defaults `NODE_ENV=test` only when it is unset, and that is what
    // makes `src/env.ts` load `.env.test`. `env-setup.ts` rejects any other
    // runner-provided value before the replica set starts.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
    },
  },
})
