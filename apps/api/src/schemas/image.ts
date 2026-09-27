import { z } from 'zod'

// The API does not host images, so every stored value is a link to one the
// client renders. Only absolute `http(s)` URLs are accepted: a protocol-relative
// or path-only value has no origin to resolve against, and other schemes
// (`javascript:`, `data:`, `file:`) are rejected rather than passed through to
// an `img src`. An empty value is the documented way to say "no image", which is
// also the models' default, so it stays valid.
const IMAGE_URL_MAX_LENGTH = 2048

const absoluteHttpUrl = z.url({ protocol: /^https?$/ })

/**
 * An image reference submitted by a client: an absolute `http(s)` URL, or an
 * empty string to clear the image. Shared by post cover images and profile
 * avatars so both fields answer a bad value the same way.
 */
export const imageUrlSchema = z
  .string()
  .trim()
  .max(IMAGE_URL_MAX_LENGTH)
  .refine((value) => value === '' || absoluteHttpUrl.safeParse(value).success, {
    message: 'Must be an absolute http(s) URL or an empty value',
  })
