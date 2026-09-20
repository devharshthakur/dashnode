import { createApp } from './app'
import { connectDb, disconnectDb } from '#config/db'
import { env } from '#env'
import { logger } from '#config/logger'

async function main() {
  await connectDb(env.MONGO_URI)

  const app = createApp()

  const server = app.listen(env.PORT, () => {
    logger.info(`API listening on http://localhost:${env.PORT}`)
  })

  async function shutdown(signal: NodeJS.Signals) {
    logger.info(`${signal} received, shutting down`)
    server.close()
    await disconnectDb()
    process.exit(0)
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })
}

main().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to start API')
  process.exit(1)
})
