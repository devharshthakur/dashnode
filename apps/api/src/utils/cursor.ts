import { Types } from 'mongoose'

/**
 * Position in a post list ordered by a timestamp descending. The timestamp
 * bounds the next page and the id settles ties, so every post keeps a single
 * stable position even when two share a timestamp.
 */
export interface PostCursor {
  at: Date
  id: Types.ObjectId
}

/**
 * Encodes a list position as an opaque URL-safe cursor. Lists page by keyset
 * instead of offset so a request never reads more rows than one page needs,
 * however deep the client has paged.
 */
export function encodePostCursor(at: Date, id: Types.ObjectId): string {
  return Buffer.from(`${at.toISOString()}|${id}`).toString('base64url')
}

/**
 * Decodes a cursor, returning null for anything this API did not issue: wrong
 * shape, non-canonical timestamp, or an id that is not an ObjectId.
 */
export function decodePostCursor(cursor: string): PostCursor | null {
  const parts = Buffer.from(cursor, 'base64url').toString('utf8').split('|')

  if (parts.length !== 2) {
    return null
  }

  const [at, id] = parts

  if (!/^[0-9a-f]{24}$/i.test(id)) {
    return null
  }

  const date = new Date(at)

  if (Number.isNaN(date.getTime()) || date.toISOString() !== at) {
    return null
  }

  return { at: date, id: new Types.ObjectId(id) }
}
