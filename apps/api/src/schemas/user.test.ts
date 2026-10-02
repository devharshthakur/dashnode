import { describe, expect, it } from 'vitest'

import { updateUserProfileBodySchema } from '#schemas/user'

// Each field is sent on its own, which is the case `PUT /users/me` promises.
describe('updateUserProfileBodySchema', () => {
  it('accepts a name on its own', () => {
    expect(updateUserProfileBodySchema.parse({ name: 'Ada Lovelace' })).toEqual(
      {
        name: 'Ada Lovelace',
      },
    )
  })

  it('accepts a bio on its own', () => {
    expect(
      updateUserProfileBodySchema.parse({ bio: 'Writes about engines' }),
    ).toEqual({ bio: 'Writes about engines' })
  })

  it('accepts an avatarUrl on its own', () => {
    expect(
      updateUserProfileBodySchema.parse({
        avatarUrl: 'https://cdn.example.com/a.png',
      }),
    ).toEqual({ avatarUrl: 'https://cdn.example.com/a.png' })
  })

  it('rejects a body carrying none of the three fields', () => {
    const parsed = updateUserProfileBodySchema.safeParse({})

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe(
      'Provide at least one of name, bio, or avatarUrl',
    )
  })

  it('applies each field’s own rules', () => {
    expect(updateUserProfileBodySchema.safeParse({ name: '   ' }).success).toBe(
      false,
    )
    expect(
      updateUserProfileBodySchema.safeParse({ name: 'a'.repeat(101) }).success,
    ).toBe(false)
    expect(
      updateUserProfileBodySchema.safeParse({ bio: 'a'.repeat(201) }).success,
    ).toBe(false)
    expect(
      updateUserProfileBodySchema.safeParse({ avatarUrl: 'not-a-url' }).success,
    ).toBe(false)
  })

  it('clears an avatar with an empty string', () => {
    expect(updateUserProfileBodySchema.parse({ avatarUrl: '' }).avatarUrl).toBe(
      '',
    )
  })
})
