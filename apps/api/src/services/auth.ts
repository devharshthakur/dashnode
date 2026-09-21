import bcrypt from 'bcryptjs'
import { User } from '#models/user'

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

    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      createdAt: user.get('createdAt'),
      updatedAt: user.get('updatedAt'),
    }
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
