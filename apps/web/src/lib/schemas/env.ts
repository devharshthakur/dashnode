import { z } from 'zod'

// A `.env` placeholder may leave the variable blank; treat that the same as
// unset so the default below still applies instead of failing on an empty URL.
function emptyStringAsUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value
}

/**
 * The one schema every build passes through, development or production.
 *
 * It sits with the request schemas rather than in `src/env.ts`, so a caller
 * that only needs the shape can import it without triggering `src/env.ts`'s
 * parse and failure branch.
 */
export const envSchema = z.object({
  VITE_API_URL: z.preprocess(
    emptyStringAsUndefined,
    z.url().default('http://localhost:8000'),
  ),
})

export type Env = z.infer<typeof envSchema>
