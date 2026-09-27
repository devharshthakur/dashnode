import bcrypt from 'bcryptjs'
import { isValidObjectId, type HydratedDocument } from 'mongoose'
import { EmailTakenError, InvalidCredentialsError } from '#errors/auth'
import { RevokedToken } from '#models/revoked-token'
import { User, type UserDocument } from '#models/user'

// Callers pass passwords already bounded to PASSWORD_MAX_BYTES UTF-8 bytes by
// `#schemas/auth`, so bcrypt hashes every character the user supplied.
const PASSWORD_SALT_ROUNDS = 10

export interface LoginUserInput {
  email: string
  password: string
}

export interface RegisterUserInput {
  name: string
  email: string
  password: string
}

// Only the fields the request carried are set, so an omitted field keeps its
// stored value instead of being overwritten with `undefined`.
export interface UpdateUserProfileInput {
  name?: string
  bio?: string
  avatarUrl?: string
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

// The password hash is deliberately never selected into this shape, so no
// response built from a SafeUser can leak one.
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

// Normalizing the email is what makes the unique index case-insensitive; the
// index on `User.email` is the source of truth for uniqueness.

/**
 * Creates a user with a bcrypt-hashed password, normalizing the email to
 * lowercase. Throws {@link EmailTakenError} when the unique index rejects a
 * registration that lost a race against a concurrent one.
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

// The hash is `select: false` on the model, so this query opts it back in.

/**
 * Authenticates a user by email and password. A missing account and a wrong
 * password both surface as {@link InvalidCredentialsError}, so neither reveals
 * which emails are registered.
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

export async function updateUserProfile(
  userId: string,
  input: UpdateUserProfileInput,
): Promise<SafeUser | null> {
  const changed = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  )

  const user = await User.findByIdAndUpdate(
    userId,
    { $set: changed },
    {
      returnDocument: 'after',
      runValidators: true,
    },
  )

  return user ? toSafeUser(user) : null
}

// The upsert keeps repeated logout with the same token harmless.

/**
 * Blacklists a token id until the token's own expiry, at which point the
 * revocation record is dropped by the TTL index.
 */
export async function revokeToken(jti: string, expiresAt: Date): Promise<void> {
  await RevokedToken.updateOne(
    { jti },
    { $setOnInsert: { expiresAt } },
    { upsert: true },
  )
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const revoked = await RevokedToken.exists({ jti })

  return revoked !== null
}
