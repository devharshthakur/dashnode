import bcrypt from 'bcryptjs'
import { isValidObjectId, type HydratedDocument } from 'mongoose'
import { RevokedToken } from '#models/revoked-token'
import { User, type UserDocument } from '#models/user'

const PASSWORD_SALT_ROUNDS = 10

export class EmailTakenError extends Error {
  constructor() {
    super('An account with this email already exists')
    this.name = 'EmailTakenError'
  }
}

export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid email or password')
    this.name = 'InvalidCredentialsError'
  }
}

export interface LoginUserInput {
  email: string
  password: string
}

export interface RegisterUserInput {
  name: string
  email: string
  password: string
}

export interface SafeUser {
  id: string
  name: string
  email: string
  bio: string
  avatarUrl: string
  createdAt: Date
  updatedAt: Date
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 11000
  )
}

/**
 * Maps a user document to the shape safe to return over HTTP. The password
 * hash is deliberately never selected into this type.
 */
function toSafeUser(user: HydratedDocument<UserDocument>): SafeUser {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    createdAt: user.get('createdAt'),
    updatedAt: user.get('updatedAt'),
  }
}

/**
 * Creates a user with a bcrypt-hashed password.
 *
 * Email is normalized to lowercase so uniqueness is case-insensitive. The
 * unique index on `User.email` is the source of truth. A losing race against a
 * concurrent registration surfaces as {@link EmailTakenError}.
 */
export async function registerUser(
  input: RegisterUserInput,
): Promise<SafeUser> {
  const passwordHash = await bcrypt.hash(input.password, PASSWORD_SALT_ROUNDS)

  try {
    const user = await User.create({
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      password: passwordHash,
    })

    return toSafeUser(user)
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new EmailTakenError()
    }

    throw error
  }
}

/**
 * Authenticates a user by email and password.
 *
 * The password hash is excluded from normal queries (`select: false`), so it
 * is explicitly selected here. Missing account and wrong password both
 * surface as {@link InvalidCredentialsError} to avoid leaking which emails
 * are registered.
 */
export async function loginUser(input: LoginUserInput): Promise<SafeUser> {
  const user = await User.findOne({ email: input.email }).select('+password')

  if (!user || !(await bcrypt.compare(input.password, user.password))) {
    throw new InvalidCredentialsError()
  }

  return toSafeUser(user)
}

/**
 * Loads a user by id for session resolution. Returns `null` for unknown ids or
 * ids that are not valid ObjectIds, so callers treat both as unauthenticated
 * instead of surfacing a database cast error.
 */
export async function getUserById(userId: string): Promise<SafeUser | null> {
  if (!isValidObjectId(userId)) {
    return null
  }

  const user = await User.findById(userId)

  return user ? toSafeUser(user) : null
}

/**
 * Blacklists a token id until the token's own expiry. The upsert keeps
 * repeated logout with the same token harmless.
 */
export async function revokeToken(jti: string, expiresAt: Date): Promise<void> {
  await RevokedToken.updateOne(
    { jti },
    { $setOnInsert: { expiresAt } },
    { upsert: true },
  )
}

/** True when a token id was blacklisted by logout. */
export async function isTokenRevoked(jti: string): Promise<boolean> {
  const revoked = await RevokedToken.exists({ jti })

  return revoked !== null
}
