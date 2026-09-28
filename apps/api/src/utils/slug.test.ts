import { describe, expect, it, vi } from 'vitest'

import type { ClientSession, Model } from 'mongoose'

import {
  appendUniqueSuffix,
  generateUniqueSlug,
  isDuplicateSlugError,
  slugify,
} from '#utils/slug'

// No document and no connection: `exists` is the only method `generateUniqueSlug`
// calls, so a fake that records the probes is enough to pin the whole rule.
describe('slugify', () => {
  it('folds a title to lowercase ASCII', () => {
    expect(slugify('Building a REST API with Express')).toBe(
      'building-a-rest-api-with-express',
    )
  })

  it('transliterates accents and drops punctuation', () => {
    expect(slugify('Café déjà vu!')).toBe('cafe-deja-vu')
  })

  // Why `#schemas/post` rejects the result: a title with no ASCII form folds to
  // nothing, and an empty slug cannot be stored.
  it('folds an input with no ASCII form to an empty string', () => {
    expect(slugify('日本語')).toBe('')
  })

  // Documented consequence, not a bug: uniqueness has to be resolved separately.
  it('collapses distinct inputs that share a folded form', () => {
    expect(slugify('C++')).toBe('c')
    expect(slugify('C#')).toBe('c')
  })
})

/** One candidate the helper probed, with the session the query carried. */
interface SlugProbe {
  slug: string
  session: ClientSession | null
}

/**
 * Stands in for a Mongoose model whose `slug` index already holds `taken`.
 * The query object exists so the helper can chain `.session()` onto it, and
 * each call is recorded for the assertions about what was probed.
 */
function fakeModel(taken: string[]) {
  const probes: SlugProbe[] = []

  const model = {
    exists: vi.fn((filter: { slug: string }) => ({
      session: (session: ClientSession | null) => {
        probes.push({ slug: filter.slug, session })

        return Promise.resolve(
          taken.includes(filter.slug) ? { _id: 'taken' } : null,
        )
      },
    })),
  }

  return { model: model as unknown as Model<{ slug: string }>, probes }
}

describe('generateUniqueSlug', () => {
  it('returns the folded input when no document holds it', async () => {
    const { model, probes } = fakeModel([])

    await expect(generateUniqueSlug('My Post', model)).resolves.toBe('my-post')
    expect(probes.map((probe) => probe.slug)).toEqual(['my-post'])
  })

  it('walks past the candidates already taken, in order', async () => {
    const { model } = fakeModel(['my-post', 'my-post-1'])

    await expect(generateUniqueSlug('My Post', model)).resolves.toBe(
      'my-post-2',
    )
  })

  it('probes with the session it was handed, and with null when it was not', async () => {
    const { model, probes } = fakeModel([])
    const session = {} as ClientSession

    await generateUniqueSlug('My Post', model, session)
    await generateUniqueSlug('My Post', model)

    expect(probes.map((probe) => probe.session)).toEqual([session, null])
  })
})

describe('appendUniqueSuffix', () => {
  it('appends a ten-character hex token to the base slug', () => {
    expect(appendUniqueSuffix('building-a-rest-api')).toMatch(
      /^building-a-rest-api-[0-9a-f]{10}$/,
    )
  })

  // A re-probe can hand the same candidate back to a caller that lost the race,
  // which is why the retry cannot be a plain probe.
  it('never repeats a token across many calls', () => {
    const slugs = Array.from({ length: 100 }, () =>
      appendUniqueSuffix('my-post'),
    )

    expect(new Set(slugs).size).toBe(slugs.length)
  })
})

describe('isDuplicateSlugError', () => {
  it('recognises a duplicate on the slug index', () => {
    expect(isDuplicateSlugError({ code: 11000, keyPattern: { slug: 1 } })).toBe(
      true,
    )
  })

  it('leaves a duplicate on another unique index to the caller', () => {
    expect(
      isDuplicateSlugError({ code: 11000, keyPattern: { email: 1 } }),
    ).toBe(false)
  })

  it('rejects a failure that is not a duplicate key', () => {
    expect(isDuplicateSlugError({ code: 11001, keyPattern: { slug: 1 } })).toBe(
      false,
    )
  })

  it('rejects a duplicate that names no index', () => {
    expect(isDuplicateSlugError({ code: 11000 })).toBe(false)
  })

  it('rejects a key pattern that is not an object', () => {
    expect(isDuplicateSlugError({ code: 11000, keyPattern: 'slug' })).toBe(
      false,
    )
  })

  it('rejects a null key pattern', () => {
    expect(isDuplicateSlugError({ code: 11000, keyPattern: null })).toBe(false)
  })

  it('rejects a value that is not an error at all', () => {
    expect(isDuplicateSlugError(null)).toBe(false)
    expect(isDuplicateSlugError(undefined)).toBe(false)
    expect(isDuplicateSlugError(11000)).toBe(false)
    expect(isDuplicateSlugError('E11000 duplicate key error')).toBe(false)
  })
})
