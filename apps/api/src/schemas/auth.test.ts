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
  // of bytes cannot pass: `Buffer.byteLength` proves each fixture sits exactly
  // on the ceiling or one byte past it, in both a one-byte and a multibyte
  // encoding.
  it.each([
    ['an ASCII', 'a'.repeat(72)],
    ['a multibyte', 'é'.repeat(PASSWORD_MAX_BYTES / 2)],
  ])('accepts %s password of exactly 72 UTF-8 bytes', (_case, password) => {
    expect(Buffer.byteLength(password)).toBe(72)

    expect(
      registerBodySchema.parse({ ...VALID_REGISTRATION, password }).password,
    ).toBe(password)
  })

  it.each([
    ['an ASCII', 'a'.repeat(73)],
    ['a multibyte', `${'é'.repeat(PASSWORD_MAX_BYTES / 2)}a`],
  ])('rejects %s password one byte over the ceiling', (_case, password) => {
    expect(Buffer.byteLength(password)).toBe(73)

    expect(() =>
      registerBodySchema.parse({ ...VALID_REGISTRATION, password }),
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
    const password = `${'é'.repeat(PASSWORD_MAX_BYTES / 2)}a`

    expect(Buffer.byteLength(password)).toBe(73)
    expect(() => loginBodySchema.parse({ ...VALID_LOGIN, password })).toThrow(
      /72 bytes/,
    )
  })
})
