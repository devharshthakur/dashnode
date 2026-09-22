import { z } from 'zod'

import { POST_STATUSES } from '#models/post'
import { slugify } from '#utils/slug'

/** True when `value` still yields a usable slug after slugification. */
function isSlugifiable(value: string): boolean {
  return slugify(value).length > 0
}

const tagNameSchema = z.string().trim().min(1).max(50).refine(isSlugifiable, {
  message: 'Tag must contain at least one letter or number',
})

const postBodySchema = z.object({
  title: z.string().trim().min(1).max(200).refine(isSlugifiable, {
    message: 'Title must contain at least one letter or number',
  }),
  // Not trimmed: leading indentation is meaningful in Markdown.
  content: z.string().refine((value) => value.trim().length > 0, {
    message: 'Content is required',
  }),
  tags: z.array(tagNameSchema).min(1).max(10),
  coverImage: z.string().trim().max(2048).optional(),
  excerpt: z.string().min(1).max(250).optional(),
  status: z.enum(POST_STATUSES),
})

export const createPostBodySchema = postBodySchema.extend({
  status: z.enum(POST_STATUSES).default('draft'),
})

export const updatePostBodySchema = postBodySchema.partial()
