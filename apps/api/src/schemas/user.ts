import { z } from 'zod'

export const updateUserProfileBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  bio: z.string().trim().max(200),
  avatarUrl: z.string().trim(),
})
