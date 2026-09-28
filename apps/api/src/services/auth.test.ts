import bcrypt from 'bcryptjs'
import { describe, expect, it, vi } from 'vitest'
import { Types } from 'mongoose'

import { EmailTakenError, InvalidCredentialsError } from '#errors/auth'
import { RevokedToken } from '#models/revoked-token'
import { User } from '#models/user'
import {
  getUserById,
  isTokenRevoked,
  loginUser,
  registerUser,
  revokeToken,
  updateUserProfile,
} from '#services/auth'
import { createUser, TEST_PASSWORD } from '#test/factories'

const REGISTRATION = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  password: 'correct-horse-battery',
}

describe('registerUser', () => {
  it('normalizes the name and the email before storing them', async () => {
    const user = await registerUser({
      name: '  Ada Lovelace  ',
      email: '  Ada@Example.COM  ',
      password: REGISTRATION.password,
    })

    expect(user.name).toBe('Ada Lovelace')
    expect(user.email).toBe('ada@example.com')
  })

  // bcrypt must never be handed the password itself, and the hash must still
  // verify against it.
  it('stores a bcrypt hash rather than the password', async () => {
    const user = await registerUser(REGISTRATION)
    const stored = await User.findById(user.id).select('+password').lean()

    expect(stored?.password).not.toBe(REGISTRATION.password)
    await expect(
      bcrypt.compare(REGISTRATION.password, stored?.password ?? ''),
    ).resolves.toBe(true)
  })

  // Absent, not merely `undefined`: a response built from this shape must carry
  // no key for the hash at all.
  it('returns a user with no password key', async () => {
    const user = await registerUser(REGISTRATION)

    expect(user).not.toHaveProperty('password')
  })

  it('returns the timestamps as dates', async () => {
    const user = await registerUser(REGISTRATION)

    expect(user.createdAt).toBeInstanceOf(Date)
    expect(user.updatedAt).toBeInstanceOf(Date)
  })

  it('rejects a second registration for an email already taken', async () => {
    await registerUser(REGISTRATION)

    await expect(
      registerUser({ ...REGISTRATION, name: 'Someone Else' }),
    ).rejects.toBeInstanceOf(EmailTakenError)
  })

  // Reusing the exact string would collide on the index whether or not it folds
  // case, so the second registration is spelled differently.
  it('rejects a second registration whose email differs only in case', async () => {
    await registerUser(REGISTRATION)

    await expect(
      registerUser({ ...REGISTRATION, email: 'ADA@Example.com' }),
    ).rejects.toBeInstanceOf(EmailTakenError)
  })

  it('collides with a document stored through the model in another casing', async () => {
    await User.create({
      name: 'Written Directly',
      email: 'Mixed.Case@Example.com',
      password: await bcrypt.hash('some-hash', 10),
    })

    await expect(
      registerUser({ ...REGISTRATION, email: 'mixed.case@example.com' }),
    ).rejects.toBeInstanceOf(EmailTakenError)
  })

  // A server fault is not the client's mistake, so it must not be dressed up as
  // one and answered with 409: the very same error object has to come back.
  it('rethrows a database failure that is not a duplicate key', async () => {
    const failure = new Error('connection reset')
    vi.spyOn(User, 'create').mockRejectedValueOnce(failure)

    await expect(registerUser(REGISTRATION)).rejects.toBe(failure)
  })
})

describe('loginUser', () => {
  it('returns the user for correct credentials, with no password key', async () => {
    await createUser(REGISTRATION)

    const user = await loginUser({
      email: REGISTRATION.email,
      password: TEST_PASSWORD,
    })

    expect(user.email).toBe(REGISTRATION.email)
    expect(user).not.toHaveProperty('password')
  })

  // The model hides the hash, so the lookup has to opt it back in. If it did
  // not, this success path would fail on an undefined hash — which is why the
  // success path is asserted rather than only the failures.
  it('reads a hash the model hides by default', async () => {
    await createUser(REGISTRATION)

    expect(User.schema.path('password')?.options?.select).toBe(false)
    await expect(
      loginUser({ email: REGISTRATION.email, password: TEST_PASSWORD }),
    ).resolves.toBeTruthy()
  })

  // The same message for both, so a failure cannot reveal which emails exist.
  it('refuses a wrong password and an unknown email identically', async () => {
    await createUser(REGISTRATION)

    const wrongPassword = await loginUser({
      email: REGISTRATION.email,
      password: 'not-the-password',
    }).catch((error: unknown) => error)
    const unknownEmail = await loginUser({
      email: 'nobody@example.com',
      password: TEST_PASSWORD,
    }).catch((error: unknown) => error)

    expect(wrongPassword).toBeInstanceOf(InvalidCredentialsError)
    expect(unknownEmail).toBeInstanceOf(InvalidCredentialsError)
    expect((unknownEmail as Error).message).toBe(
      (wrongPassword as Error).message,
    )
  })
})

describe('getUserById', () => {
  it('returns null for an id that is not an ObjectId', async () => {
    await expect(getUserById('not-an-object-id')).resolves.toBeNull()
  })

  it('returns null for a valid id nobody uses', async () => {
    await expect(getUserById(new Types.ObjectId().toHexString())).resolves.toBe(
      null,
    )
  })

  it('returns the user for a real id, with no password key', async () => {
    const created = await createUser(REGISTRATION)

    const user = await getUserById(created.id)

    expect(user?.email).toBe(REGISTRATION.email)
    expect(user).not.toHaveProperty('password')
  })
})

describe('updateUserProfile', () => {
  it('changes only the fields the request carried', async () => {
    const created = await createUser({
      ...REGISTRATION,
      bio: 'Original bio',
      avatarUrl: 'https://cdn.example.com/original.png',
    })

    const updated = await updateUserProfile(created.id, { bio: 'New bio' })

    expect(updated?.bio).toBe('New bio')
    expect(updated?.name).toBe('Ada Lovelace')
    expect(updated?.avatarUrl).toBe('https://cdn.example.com/original.png')
  })

  // An explicit `undefined` is what a caller that spreads a partial body hands
  // over, and `$set: { name: undefined }` would erase the stored name.
  it('keeps a stored field whose value is explicitly undefined', async () => {
    const created = await createUser({
      ...REGISTRATION,
      bio: 'Original bio',
      avatarUrl: 'https://cdn.example.com/original.png',
    })

    const updated = await updateUserProfile(created.id, {
      bio: 'New bio',
      name: undefined,
      avatarUrl: undefined,
    })

    expect(updated).toMatchObject({
      bio: 'New bio',
      name: 'Ada Lovelace',
      avatarUrl: 'https://cdn.example.com/original.png',
    })
  })

  // A direct service call must not be able to store a value the route would
  // refuse: `runValidators` is what applies the model's 200-character cap here.
  it('refuses a bio the model validator rejects', async () => {
    const created = await createUser(REGISTRATION)

    await expect(
      updateUserProfile(created.id, { bio: 'a'.repeat(201) }),
    ).rejects.toThrow()
    await expect(getUserById(created.id)).resolves.toMatchObject({
      bio: '',
    })
  })

  it('clears a bio with an empty string', async () => {
    const created = await createUser({ ...REGISTRATION, bio: 'Something' })

    await expect(
      updateUserProfile(created.id, { bio: '' }),
    ).resolves.toMatchObject({ bio: '' })
  })

  it('returns null for an unknown user', async () => {
    await expect(
      updateUserProfile(new Types.ObjectId().toHexString(), { bio: 'x' }),
    ).resolves.toBeNull()
  })
})

describe('revocation', () => {
  // A date relative to the run, not a fixed one: the TTL index drops a record
  // once its `expiresAt` passes, so a literal in the past would let the server
  // delete the document before the assertions below read it.
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  it('remembers a revoked token until it would have expired', async () => {
    await revokeToken('a-jti', expiresAt)

    await expect(isTokenRevoked('a-jti')).resolves.toBe(true)
    await expect(
      RevokedToken.findOne({ jti: 'a-jti' }).lean(),
    ).resolves.toMatchObject({ expiresAt })
  })

  // Repeated logout is normal client behavior, not an edge case.
  it('keeps one record when the same token is revoked twice', async () => {
    await revokeToken('a-jti', expiresAt)
    await revokeToken('a-jti', expiresAt)

    await expect(RevokedToken.countDocuments({ jti: 'a-jti' })).resolves.toBe(1)
  })

  it('does not report a token nobody revoked', async () => {
    await expect(isTokenRevoked('never-revoked')).resolves.toBe(false)
  })
})
