import { describe, expect, it } from 'vitest'

import { API_PREFIX, DEFAULT_POST_PAGE_SIZE } from '#config/constants'

// Proves the runner works end to end: the file is picked up by `include`, the
// `#config/*` alias from `package.json#imports` resolves, and TypeScript is
// transformed without a build step.
describe('API constants', () => {
  it('mounts every route under the /api prefix', () => {
    expect(API_PREFIX).toBe('/api')
  })

  it('defaults post lists to ten per page', () => {
    expect(DEFAULT_POST_PAGE_SIZE).toBe(10)
  })
})
