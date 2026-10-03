import { QueryClient } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiRequest } from '#lib/config/axios'
import { postQueryOptions } from '#lib/posts'

vi.mock('#lib/config/axios', () => ({
  apiRequest: vi.fn(),
}))

describe('postQueryOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads a published post by an encoded slug', async () => {
    const response = { post: { slug: 'a post' } }
    vi.mocked(apiRequest).mockResolvedValue(response)

    const client = new QueryClient()
    const options = postQueryOptions('a post')

    await expect(client.query(options)).resolves.toEqual(response)
    expect(options.queryKey).toEqual(['posts', 'detail', 'a post'])
    expect(apiRequest).toHaveBeenCalledWith('/posts/a%20post')
    client.clear()
  })
})
