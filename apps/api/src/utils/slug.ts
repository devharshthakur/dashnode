import { randomUUID } from 'node:crypto'

import type { ClientSession, Model } from 'mongoose'
import libSlugify from 'slugify'

// Folds a post title or tag name to lowercase ASCII: accents are transliterated
// and punctuation dropped. Characters with no ASCII form are removed rather
// than approximated, so a title written entirely in one slugifies to nothing —
// which is why `#schemas/post` rejects an input that folds to an empty slug.
// Distinct inputs can also collapse onto one slug (`C++` and `C#` both become
// `c`), so callers that must keep them apart resolve uniqueness separately.
//
//   slugify('Building a REST API with Express') // 'building-a-rest-api-with-express'
//   slugify('Café déjà vu!') // 'cafe-deja-vu'
export function slugify(input: string): string {
  return libSlugify(input, { lower: true, strict: true })
}

// Returns a slug no document of `model` stores yet: the folded input first,
// then a numeric suffix while the candidate is taken (`title`, `title-1`,
// `title-2`, ...), so the result is deterministic for a given set of existing
// slugs. Pass the model that will store the slug — the `Post` or `Tag` model,
// and nothing wider is relied on — and pass `session` when the probe has to see
// rows written earlier in the same transaction.
//
// Two callers share this rule and nothing else. `createPost` picks a post slug
// from a title; `resolveTagIds` picks one for a new tag, which folds its
// submitted name because a tag stores the name apart from its slug.
//
// Probing and inserting are separate steps, and a concurrent write's insert
// stays invisible until it commits, so a caller can still be beaten to the slug
// it was handed. Only post creation absorbs that: it retries on the
// duplicate-key error `isDuplicateSlugError` recognises and settles on
// `appendUniqueSuffix`. A tag is created inside its post's transaction after a
// lookup by name, so it stores the slug it probed; two requests introducing the
// same new tag at once are stopped by the unique index on `name` instead.
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

// Hex characters of the random token appended to a slug that lost a race.
const UNIQUE_SUFFIX_LENGTH = 10

// Used where a request that lost the slug race cannot simply read again:
// re-probing can hand out the same candidate, because the winner's row stays
// invisible until its transaction commits. A fresh random token cannot be the
// suffix another request already chose, and practically never matches a slug
// that is stored, so the retry succeeds on the attempt it is made. Only a
// request that lost a race is given this form, which keeps the readable
// `title` / `title-1` slugs that come from a plain probe.
//
//   appendUniqueSuffix('building-a-rest-api') // 'building-a-rest-api-3f9c1a7b2e'
export function appendUniqueSuffix(base: string): string {
  const token = randomUUID().replaceAll('-', '').slice(0, UNIQUE_SUFFIX_LENGTH)

  return `${base}-${token}`
}

/** A rejected write as MongoDB reports it: its error code and the index hit. */
type MongoServerError = {
  code?: unknown
  keyPattern?: unknown
}

// MongoDB's duplicate-key error code, carried through from the server reply.
const DUPLICATE_KEY_CODE = 11000

// Recognises the unique index catching the race `generateUniqueSlug` cannot
// close by itself: it returns a slug that is free at the moment it reads, and
// the insert happens afterwards, so a concurrent write can claim the same slug
// in between. Knowing the guard fired lets the caller pick another slug instead
// of reporting a server fault.
//
// The index the duplicate landed on is checked as well as the error code, so a
// duplicate on any other unique index is not mistaken for a slug collision.
// Every other database failure is left to the caller, untouched.
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
