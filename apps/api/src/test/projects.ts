// The two Vitest projects the suite runs as, listed explicitly so a test file
// can never be picked up by the wrong project or by neither. Paths are relative
// to `apps/api` and are shared by `vitest.config.ts` and the classification
// assertion in `src/test/harness.test.ts`.

/**
 * Tests that never touch MongoDB: schemas, pure utilities, environment parsing,
 * and the origin middleware driven directly. They run without a replica set, a
 * connection, or index/collection setup.
 */
export const PURE_TEST_FILES: string[] = [
  'src/schemas/auth.test.ts',
  'src/schemas/image.test.ts',
  'src/schemas/post.test.ts',
  'src/schemas/user.test.ts',
  'src/utils/auth.test.ts',
  'src/utils/cursor.test.ts',
  'src/utils/post.test.ts',
  'src/utils/slug.test.ts',
  'src/env.test.ts',
  'src/env.parsing.test.ts',
  'src/test/env-setup.test.ts',
  'src/middlewares/origin.test.ts',
]

/**
 * Tests that drive real routes, services, or models, and so need the in-memory
 * replica set, the shared connection, and the collection lifecycle.
 */
export const DATABASE_TEST_FILES: string[] = [
  'src/services/auth.test.ts',
  'src/services/post.test.ts',
  'src/services/tag.test.ts',
  'src/services/user.test.ts',
  'src/routes/auth.test.ts',
  'src/routes/posts.test.ts',
  'src/routes/tags.test.ts',
  'src/routes/users.test.ts',
  'src/middlewares/auth.test.ts',
  'src/middlewares/error.test.ts',
  'src/test/harness.test.ts',
]
