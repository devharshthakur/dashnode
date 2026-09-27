import mongoose from 'mongoose'

// Every database call that has to commit or roll back with the others needs the
// `session` handed to `fn` — in this service that is a post together with the
// tags it links. Transactions need a replica set, which is why the local
// docker-compose runs a single-node one; managed MongoDB (Atlas) always is one.

/**
 * Runs `fn` inside a multi-document transaction and returns its result. Errors
 * thrown inside `fn` abort the transaction, and transient failures (for example
 * a dropped primary) are retried automatically before the whole callback is
 * re-run.
 */
export async function withTransaction<T>(
  fn: (session: mongoose.ClientSession) => Promise<T>,
): Promise<T> {
  const session = await mongoose.startSession()

  try {
    return await session.withTransaction(fn)
  } finally {
    await session.endSession()
  }
}
