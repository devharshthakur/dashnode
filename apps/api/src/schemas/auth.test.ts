import { describe, expect, it } from 'vitest'

import { PASSWORD_MAX_BYTES } from '#config/constants'
import { loginBodySchema, registerBodySchema } from '#schemas/auth'

const VALID_REGISTRATION = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'correct-horse',
}

describe('registerBodySchema', () => {
  it('accepts a well-formed registration', () => {
    expect(registerBodySchema.parse(VALID_REGISTRATION)).toEqual(
      VALID_REGISTRATION,
    )
  })

  it('trims the name', () => {
    expect(
      registerBodySchema.parse({ ...VALID_REGISTRATION, name: '  Ada  ' }).name,
    ).toBe('Ada')
  })

  it('rejects a name that is only whitespace', () => {
    expect(() =>
      registerBodySchema.parse({ ...VALID_REGISTRATION, name: '   ' }),
    ).toThrow()
  })

  it('rejects a name longer than 100 characters', () => {
    expect(() =>
      registerBodySchema.parse({
        ...VALID_REGISTRATION,
        name: 'a'.repeat(101),
      }),
    ).toThrow()
  })

  it('normalizes the email before it reaches the service', () => {
    expect(
      registerBodySchema.parse({
        ...VALID_REGISTRATION,
        email: '  Ada@Example.COM  ',
      }).email,
    ).toBe('ada@example.com')
  })

  it('rejects a value that is not an email address', () => {
    expect(() =>
      registerBodySchema.parse({ ...VALID_REGISTRATION, email: 'nope' }),
    ).toThrow()
  })

  it('rejects a password shorter than 8 characters', () => {
    expect(() =>
      registerBodySchema.parse({ ...VALID_REGISTRATION, password: '1234567' }),
    ).toThrow()
  })

  // The #24 rule, and the assertion that a schema measuring characters instead
  // of bytes cannot pass: every other case in this file is under the limit in
  // both units, so only a multibyte password at the boundary separates them.
  it('accepts a password of exactly 72 UTF-8 bytes', () => {
    const password = 'é'.repeat(PASSWORD_MAX_BYTES / 2)

    expect(
      registerBodySchema.parse({ ...VALID_REGISTRATION, password }).password,
    ).toBe(password)
  })

  it('rejects a multibyte password one byte over the ceiling', () => {
    const password = 'é'.repeat(PASSWORD_MAX_BYTES / 2 + 1)

    expect(() =>
      registerBodySchema.parse({ ...VALID_REGISTRATION, password }),
    ).toThrow(/72 bytes/)
  })

  it('rejects a 100-character password that is only 100 bytes', () => {
    expect(() =>
      registerBodySchema.parse({
        ...VALID_REGISTRATION,
        password: 'a'.repeat(100),
      }),
    ).toThrow(/72 bytes/)
  })
})

describe('loginBodySchema', () => {
  const VALID_LOGIN = { email: 'ada@example.com', password: 'correct-horse' }

  it('accepts a one-character password', () => {
    expect(
      loginBodySchema.parse({ ...VALID_LOGIN, password: 'a' }).password,
    ).toBe('a')
  })

  it('normalizes the email before it reaches the service', () => {
    expect(
      loginBodySchema.parse({ ...VALID_LOGIN, email: ' Ada@Example.COM ' })
        .email,
    ).toBe('ada@example.com')
  })

  it('applies the same byte ceiling as registration', () => {
    expect(() =>
      loginBodySchema.parse({
        ...VALID_LOGIN,
        password: 'é'.repeat(PASSWORD_MAX_BYTES / 2 + 1),
      }),
    ).toThrow(/72 bytes/)
  })
})
