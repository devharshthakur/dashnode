import { defineConfig } from 'vitest/config'

// The environment every test runs against, installed through `test.env` so a
// test run never depends on a developer's local `.env`. Exported so a test can
// assert that none of these values were replaced on the way in.
export const testEnv = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  JWT_SECRET: 'vitest-only-signing-secret-never-used-outside-tests',
  CORS_ORIGIN: 'http://localhost:5173',
}

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['**/node_modules/**', 'build/**'],
    // `globals` stays off so test files import `describe` / `it` / `expect`
    // explicitly, the same way the source imports what it uses.
    setupFiles: ['src/test/setup.ts'],
    // The first run against a transaction-backed in-memory MongoDB is slow, and
    // the replica-set harness boots once per run.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: { ...testEnv },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
    },
  },
})
