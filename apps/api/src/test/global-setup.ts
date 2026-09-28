import { MongoMemoryReplSet } from 'mongodb-memory-server'
import type { MongoMemoryReplSet as ReplSet } from 'mongodb-memory-server'

import { TEST_MONGO_URI } from '#test/mongo-uri'

let replSet: ReplSet | undefined

/**
 * Starts the one database the whole suite shares and stops it when the run ends.
 *
 * `wiredTiger` is pinned rather than left to the default: the ephemeral engine
 * this package falls back to is a standalone, and every post and tag write runs
 * inside a transaction, which MongoDB only offers on a replica set member.
 */
export async function setup(): Promise<void> {
  try {
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: 'wiredTiger' },
    })
  } catch (error) {
    throw new Error(
      'Could not start the in-memory MongoDB replica set. The first run of a ' +
        'fresh clone downloads a `mongod` binary, so it needs network access; ' +
        'behind a proxy set MONGOMS_DOWNLOAD_MIRROR. The original failure is ' +
        `below.\n${String(error)}`,
      { cause: error },
    )
  }

  // The workers are started after this file runs, so they inherit the value.
  process.env[TEST_MONGO_URI] = replSet.getUri()
}

export async function teardown(): Promise<void> {
  await replSet?.stop()
  replSet = undefined
}
