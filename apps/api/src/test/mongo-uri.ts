/** Name of the environment variable the harness hands its URI to the workers. */
export const TEST_MONGO_URI = 'TEST_MONGO_URI'

/**
 * The URI one test file connects to.
 *
 * Vitest runs files in parallel, each in its own worker holding its own Mongoose
 * connection, and every file empties the collections it needs before a test. One
 * shared database would let two files delete each other's rows mid-test, so each
 * worker gets a database of its own and reuses it for the next file it runs —
 * files never overlap inside a worker, so the rows cannot collide either.
 */
export function databaseUri(baseUri: string): string {
  const pool = process.env.VITEST_POOL_ID ?? 'pool'
  const worker = process.env.VITEST_WORKER_ID ?? '0'
  const url = new URL(baseUri)

  url.pathname = `/test-${pool}-${worker}`

  return url.toString()
}
