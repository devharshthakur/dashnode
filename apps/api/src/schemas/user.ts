import { z } from 'zod'

import { imageUrlSchema } from '#schemas/image'

// Every field is optional so a client can change one profile field without
// resending the others; the ones it omits keep their stored values. An update
// carrying no known field is rejected instead of silently changing nothing.
export const updateUserProfileBodySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    bio: z.string().trim().max(200).optional(),
    avatarUrl: imageUrlSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: 'Provide at least one of name, bio, or avatarUrl',
  })
