import { describe, expect, it } from 'vitest'

import { InvalidUserIdError, UserNotFoundError } from '#errors/user'

describe('user errors', () => {
  it.each([
    [new InvalidUserIdError(), 'InvalidUserIdError', 'Invalid user id'],
    [new UserNotFoundError(), 'UserNotFoundError', 'User not found'],
  ])('%o carries its own name and message', (error, name, message) => {
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe(name)
    expect(error.message).toBe(message)
  })
})
