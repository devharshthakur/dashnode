import { z } from 'zod'

import { PASSWORD_MAX_BYTES } from '#config/constants'

/**
 * bcrypt stops reading a password after {@link PASSWORD_MAX_BYTES} bytes and
 * ignores the rest, so a multibyte password under the character limit can
 * still overflow the byte limit: `é` repeated 37 times is 37 characters but 74
 * bytes, and it would hash exactly like the first 36 characters. Measuring in
 * bytes therefore keeps every accepted password fully considered by the hash
 * instead of silently collapsing distinct passwords onto one.
 */
function isWithinPasswordByteLimit(value: string): boolean {
  return Buffer.byteLength(value, 'utf8') <= PASSWORD_MAX_BYTES
}

const passwordByteLimitMessage = `Password must not exceed ${PASSWORD_MAX_BYTES} bytes when encoded as UTF-8`

export const registerBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z
    .string()
    .min(8)
    .refine(isWithinPasswordByteLimit, { message: passwordByteLimitMessage }),
})

export const loginBodySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  // Same byte limit as registration: a password bcrypt would have to truncate
  // can never match a stored hash, so it is rejected as invalid input rather
  // than compared against a shortened prefix.
  password: z
    .string()
    .min(1)
    .refine(isWithinPasswordByteLimit, { message: passwordByteLimitMessage }),
})
