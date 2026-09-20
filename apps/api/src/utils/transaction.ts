import mongoose from 'mongoose'

/**
 * Runs `fn` inside a multi-document transaction and returns its result.
 *
 * Pass the provided `session` to every database operation that must be part of
 * the same atomic unit. Errors thrown inside `fn` abort the transaction, and
 * transient failures (for example a dropped primary) are retried automatically
 * before the whole callback is re-run.
 *
 * Requires a replica set. The local docker-compose runs a single-node one, and
 * managed MongoDB (Atlas) always is one.
 *
 * @example
 * await withTransaction(async (session) => {
 *   const [user] = await User.create([{ name, email }], { session })
 *   await Post.create([{ title, author: user._id }], { session })
 * })
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
