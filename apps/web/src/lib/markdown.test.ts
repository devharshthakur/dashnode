import { describe, expect, it } from 'vitest'

import { highlightMarkdownCode } from '#lib/markdown'

describe('highlightMarkdownCode', () => {
  it('highlights supported languages and escapes code content', () => {
    const html = highlightMarkdownCode(
      'const message: string = "<script>"',
      'ts',
    )

    expect(html).toContain('th-keyword')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
  })
})
