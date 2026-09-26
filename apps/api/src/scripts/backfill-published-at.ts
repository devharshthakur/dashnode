import { connectDb, disconnectDb } from '#config/db'
import { logger } from '#config/logger'
import { Post } from '#models/post'
import { env } from '#env'

/**
 * One-off backfill for posts published before `publishedAt` existed. Their
 * only known publication signal is the creation timestamp, so use that. Run
 * once per database after deploying the field:
 *
 *   pnpm --filter api backfill:published-at
 */
async function main() {
  await connectDb(env.MONGO_URI)

  const result = await Post.updateMany(
    { status: 'published', publishedAt: null },
    [{ $set: { publishedAt: '$createdAt' } }],
    // Mongoose 9 requires opting into pipeline updates; timestamps stay put so
    // the backfill does not look like an edit.
    { updatePipeline: true, timestamps: false },
  )

  logger.info(
    { matched: result.matchedCount, updated: result.modifiedCount },
    'Backfilled publishedAt from createdAt for published posts without one',
  )

  await disconnectDb()
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, 'Failed to backfill publishedAt')
  await disconnectDb()
  process.exit(1)
})
