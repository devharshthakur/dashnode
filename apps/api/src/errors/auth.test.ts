import { describe, expect, it } from 'vitest'

import { EmailTakenError, InvalidCredentialsError } from '#errors/auth'

describe('auth errors', () => {
  it('names a taken email and says so', () => {
    const error = new EmailTakenError()

    expect(error.name).toBe('EmailTakenError')
    expect(error.message).toBe('An account with this email already exists')
  })

  // The same message for both cases, so a login failure cannot reveal which
  // emails are registered.
  it('gives bad credentials one message', () => {
    const error = new InvalidCredentialsError()

    expect(error.name).toBe('InvalidCredentialsError')
    expect(error.message).toBe('Invalid email or password')
  })

  it('is catchable as an Error', () => {
    expect(new EmailTakenError()).toBeInstanceOf(Error)
  })
})
