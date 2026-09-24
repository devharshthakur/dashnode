import mongoose from 'mongoose'

import { logger } from '#config/logger'

logger.info('Connecting to MongoDB')

mongoose.connection.on('connected', () => {
  logger.info(`MongoDB connected to "${mongoose.connection.name}"`)
})

mongoose.connection.on('disconnected', () => {
  logger.info('MongoDB disconnected')
})

mongoose.connection.on('error', (error: unknown) => {
  logger.error({ err: error }, 'MongoDB connection error')
})

export async function connectDb(uri: string) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  })
}

export async function disconnectDb() {
  await mongoose.disconnect()
}
