import { z } from 'zod'

// Mirrors the rules the API enforces on register and login bodies
// (apps/api/src/schemas/auth.ts). The limit is measured in UTF-8 bytes, not
// characters: bcrypt folds only the first 72 bytes of a password into its
// hash, so anything longer must be rejected before the API compares it.
const PASSWORD_MAX_BYTES = 72

function isWithinPasswordByteLimit(value: string): boolean {
  return new TextEncoder().encode(value).length <= PASSWORD_MAX_BYTES
}

const passwordByteLimitMessage = `Password must not exceed ${PASSWORD_MAX_BYTES} bytes when encoded as UTF-8`

const emailSchema = z
  .string()
  .trim()
  .pipe(z.email('Enter a valid email address.'))

export const loginSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .min(1, 'Enter your password.')
    .refine(isWithinPasswordByteLimit, { error: passwordByteLimitMessage }),
})

export const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter your name.')
    .max(100, 'Name must be at most 100 characters.'),
  email: emailSchema,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters.')
    .refine(isWithinPasswordByteLimit, { error: passwordByteLimitMessage }),
})
