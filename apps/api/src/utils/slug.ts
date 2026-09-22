import type { Model } from 'mongoose'
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
 * instead of duplicating lookup logic. Candidates are probed in a fixed order,
 * making the result deterministic for a given set of existing slugs.
 */
export async function generateUniqueSlug<T extends { slug: string }>(
  input: string,
  model: Model<T>,
): Promise<string> {
  const base = slugify(input)
  let candidate = base
  let suffix = 1

  while ((await model.exists({ slug: candidate })) !== null) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}
