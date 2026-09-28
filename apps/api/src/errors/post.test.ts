import { describe, expect, it } from 'vitest'

import {
  InvalidPostIdError,
  PostForbiddenError,
  PostNotFoundError,
} from '#errors/post'

// Routes map these three to 400, 404 and 403, so they must stay distinct:
// folding them into one would answer a wrong status for a real failure.
describe('post errors', () => {
  it.each([
    [new InvalidPostIdError(), 'InvalidPostIdError', 'Invalid post id'],
    [new PostNotFoundError(), 'PostNotFoundError', 'Post not found'],
    [
      new PostForbiddenError(),
      'PostForbiddenError',
      'You can only modify your own posts',
    ],
  ])('%o carries its own name and message', (error, name, message) => {
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe(name)
    expect(error.message).toBe(message)
  })

  it('keeps the three cases separable', () => {
    expect(new PostForbiddenError()).not.toBeInstanceOf(PostNotFoundError)
    expect(new PostNotFoundError()).not.toBeInstanceOf(InvalidPostIdError)
  })
})
