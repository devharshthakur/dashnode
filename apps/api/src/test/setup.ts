import mongoose from 'mongoose'
import { afterAll, beforeAll, beforeEach } from 'vitest'

import { Post } from '#models/post'
import { RevokedToken } from '#models/revoked-token'
import { Tag } from '#models/tag'
import { User } from '#models/user'
import { databaseUri, TEST_MONGO_URI } from '#test/mongo-uri'

// Runs before every test file: the connection lifecycle the whole suite shares.
const baseUri = process.env[TEST_MONGO_URI]

if (!baseUri) {
  throw new Error(
    `${TEST_MONGO_URI} is not set, so there is nothing to connect to. The ` +
      'replica set is started by src/test/global-setup.ts; run the suite with ' +
      '`pnpm test` so Vitest loads it.',
  )
}

const collections = [
  () => User.deleteMany({}),
  () => Post.deleteMany({}),
  () => Tag.deleteMany({}),
  () => RevokedToken.deleteMany({}),
]

beforeAll(async () => {
  await mongoose.connect(databaseUri(baseUri))

  // Mongoose builds indexes in the background, so a test that registers two
  // identical emails could otherwise pass or fail depending on timing. These
  // are the unique indexes `email`, `name` and `slug` hang off.
  await Promise.all([
    User.syncIndexes(),
    Post.syncIndexes(),
    Tag.syncIndexes(),
    RevokedToken.syncIndexes(),
  ])
})

beforeEach(async () => {
  // `deleteMany` rather than `drop`: dropping a collection takes its indexes
  // with it, and the next test needs the unique ones back.
  await Promise.all(collections.map((clear) => clear()))
})

afterAll(async () => {
  await mongoose.disconnect()
})
