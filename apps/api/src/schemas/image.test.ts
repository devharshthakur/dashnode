import { describe, expect, it } from 'vitest'

import { imageUrlSchema } from '#schemas/image'

describe('imageUrlSchema', () => {
  it.each([
    'http://cdn.example.com/a.png',
    'https://cdn.example.com/a.png',
    'https://cdn.example.com/a.png?size=large#top',
  ])('accepts the absolute http(s) URL %s', (url) => {
    expect(imageUrlSchema.parse(url)).toBe(url)
  })

  // The documented way to say "no image", and the models' default.
  it('accepts an empty value so an image can be cleared', () => {
    expect(imageUrlSchema.parse('')).toBe('')
  })

  it('trims surrounding whitespace', () => {
    expect(imageUrlSchema.parse('  https://cdn.example.com/a.png  ')).toBe(
      'https://cdn.example.com/a.png',
    )
  })

  it.each([
    ['a value that is not a URL at all', 'not-a-url'],
    ['a relative path', '/images/a.png'],
    ['a protocol-relative URL', '//cdn.example.com/a.png'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a data URL', 'data:image/png;base64,AAAA'],
    ['a file URL', 'file:///etc/passwd'],
  ])('rejects %s', (_case, url) => {
    expect(imageUrlSchema.safeParse(url).success).toBe(false)
  })

  it('rejects a URL longer than 2048 characters', () => {
    const url = `https://cdn.example.com/${'a'.repeat(2048)}`

    expect(imageUrlSchema.safeParse(url).success).toBe(false)
  })

  it('accepts a URL of exactly 2048 characters', () => {
    const prefix = 'https://cdn.example.com/'
    const url = prefix + 'a'.repeat(2048 - prefix.length)

    expect(url).toHaveLength(2048)
    expect(imageUrlSchema.safeParse(url).success).toBe(true)
  })
})
