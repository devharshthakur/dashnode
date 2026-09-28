import { describe, expect, it } from 'vitest'

import { Types } from 'mongoose'

import { decodePostCursor, encodePostCursor } from '#utils/cursor'

const AT = new Date('2026-01-15T09:30:00.000Z')
const ID = new Types.ObjectId('65f1c0de5a1e2b3c4d5e6f70')

/**
 * Encodes text the way `encodePostCursor` does, so a test can hand the decoder a
 * shape this API would never have issued.
 */
function rawCursor(value: string): string {
  return Buffer.from(value).toString('base64url')
}

describe('encodePostCursor', () => {
  it('round-trips a timestamp and an id through the decoder', () => {
    const decoded = decodePostCursor(encodePostCursor(AT, ID))

    expect(decoded?.at).toEqual(AT)
    expect(decoded?.id).toEqual(ID)
  })
})

describe('decodePostCursor', () => {
  it('rejects a cursor with no separator', () => {
    expect(decodePostCursor(rawCursor(AT.toISOString()))).toBeNull()
  })

  it('rejects a cursor with more than one separator', () => {
    expect(
      decodePostCursor(rawCursor(`${AT.toISOString()}|${ID}|extra`)),
    ).toBeNull()
  })

  it('rejects an id that is not an ObjectId', () => {
    expect(
      decodePostCursor(rawCursor(`${AT.toISOString()}|not-an-object-id`)),
    ).toBeNull()
  })

  it('rejects a timestamp Date cannot parse', () => {
    expect(decodePostCursor(rawCursor(`not-a-date|${ID}`))).toBeNull()
  })

  // The check that is easy to drop. `2026-01-01` parses to a real Date, so
  // without the round-trip comparison it would decode as midnight UTC and hand
  // back a position the client never asked for.
  it('rejects a timestamp this API would not have written', () => {
    expect(decodePostCursor(rawCursor(`2026-01-01|${ID}`))).toBeNull()
  })
})
