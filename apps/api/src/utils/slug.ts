import { randomUUID } from 'node:crypto'

import type { ClientSession, Model } from 'mongoose'
import libSlugify from 'slugify'

/**
 * Turns arbitrary text (typically a title) into a URL-safe slug.
 * Uses slugify package with defined config
 *
 * @example
 * slugify('Building a REST API with Express') // 'building-a-rest-api-with-express'
 * slugify('Café déjà vu!') // 'cafe-deja-vu'
 */
export function slugify(input: string): string {
  return libSlugify(input, { lower: true, strict: true })
}

/**
 * Builds a unique slug for `input` against the slugs already stored by `model`.
 *
 * The base slug is tried first, then a numeric suffix is appended until the
 * slug is free (`title`, `title-1`, `title-2`, ...). Pass the `Post` or `Tag`
 * model at the call site so both services share one uniqueness implementation
 * instead of duplicating lookup logic. Pass `session` when generating inside a
 * transaction so the probe sees slugs written earlier in that same transaction.
 * Candidates are probed in a fixed order, making the result deterministic for a
 * given set of existing slugs.
 *
 * Probing and inserting are two separate steps, and the insert is not visible to
 * other readers until the transaction that made it commits, so a concurrent
 * write can take the slug in between — and can still be holding it when a later
 * probe runs. A caller that stores the result must therefore still expect a
 * duplicate-key error, which `isDuplicateSlugError` recognises and
 * `appendUniqueSuffix` answers.
 */
export async function generateUniqueSlug<T extends { slug: string }>(
  input: string,
  model: Model<T>,
  session?: ClientSession,
): Promise<string> {
  const base = slugify(input)
  let candidate = base
  let suffix = 1

  while (
    (await model.exists({ slug: candidate }).session(session ?? null)) !== null
  ) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}

/** Hex characters of the random token appended to a slug that lost a race. */
const UNIQUE_SUFFIX_LENGTH = 10

/**
 * Appends a token unique to this call to `base`, producing a slug that no
 * concurrent request can be holding.
 *
 * `generateUniqueSlug` finds a slug that is free at the moment it reads, but a
 * request that lost the race needs a different slug rather than another read:
 * the winner's row is written inside a transaction and stays invisible until
 * that transaction commits, so re-probing can hand out the same candidate
 * again. A fresh random token cannot be the suffix another request already
 * chose, and practically never matches a slug that is stored, so the retry
 * succeeds on the attempt it is made.
 *
 * Only a request that lost a race is given this form, which keeps the readable
 * `title` / `title-1` slugs that come from a plain probe.
 *
 * @example
 * appendUniqueSuffix('building-a-rest-api') // 'building-a-rest-api-3f9c1a7b2e'
 */
export function appendUniqueSuffix(base: string): string {
  const token = randomUUID().replaceAll('-', '').slice(0, UNIQUE_SUFFIX_LENGTH)

  return `${base}-${token}`
}

/** A rejected write as MongoDB reports it: its error code and the index hit. */
type MongoServerError = {
  code?: unknown
  keyPattern?: unknown
}

/** MongoDB's duplicate-key error code, carried through from the server reply. */
const DUPLICATE_KEY_CODE = 11000

/**
 * Reports whether `error` is MongoDB refusing a write because a unique index
 * already holds the `slug` it tried to store.
 *
 * This is the race `generateUniqueSlug` cannot close by itself: it probes for a
 * free slug and returns it, and the insert happens afterwards, so a concurrent
 * write can claim the same slug in between. The unique index is the guard that
 * catches it, and this recognises the guard firing so the caller can pick
 * another slug instead of reporting a server fault.
 *
 * The index the duplicate landed on is checked as well as the error code, so a
 * duplicate on any other unique index is not mistaken for a slug collision.
 * Every other database failure is left to the caller, untouched.
 */
export function isDuplicateSlugError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  const { code, keyPattern } = error as MongoServerError

  return (
    code === DUPLICATE_KEY_CODE &&
    typeof keyPattern === 'object' &&
    keyPattern !== null &&
    Object.hasOwn(keyPattern, 'slug')
  )
}
