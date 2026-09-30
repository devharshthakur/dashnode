import { defineConfig } from 'vitest/config'

import { DATABASE_TEST_FILES, PURE_TEST_FILES } from './src/test/projects.ts'

// The suite runs as two projects that share one invocation. The pure project
// has no database, so it skips the replica set, the connection, and the index
// and collection lifecycle; the database project runs them. `extends: true`
// inherits the root environment and timeouts into each project.
export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'pure',
          include: PURE_TEST_FILES,
          // The env gate runs here too, so a missing or invalid `.env.test` or
          // an unexpected runner NODE_ENV aborts before any pure test executes;
          // there is no replica set to start.
          globalSetup: ['src/test/env-setup.ts'],
          isolate: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'database',
          include: DATABASE_TEST_FILES,
          setupFiles: ['src/test/setup.ts'],
          // The env gate runs first, then the one in-memory replica set the
          // whole database-backed suite shares, stopped when the run ends.
          globalSetup: ['src/test/env-setup.ts', 'src/test/global-setup.ts'],
          isolate: true,
        },
      },
    ],
  },
})
