import { z } from 'zod'

import { DEFAULT_POST_PAGE_SIZE, MAX_POST_PAGE_SIZE } from '#config/constants'
import { POST_STATUSES } from '#models/post'
import { imageUrlSchema } from '#schemas/image'
import { decodePostCursor } from '#utils/cursor'
import { slugify } from '#utils/slug'

// True when `value` still yields a usable slug after slugification; an input
// that folds to nothing is rejected before it can produce an unreachable URL.
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
  coverImage: imageUrlSchema.optional(),
  excerpt: z.string().min(1).max(250).optional(),
  status: z.enum(POST_STATUSES),
})

export const createPostBodySchema = postBodySchema.extend({
  status: z.enum(POST_STATUSES).default('draft'),
})

export const updatePostBodySchema = postBodySchema.partial()

/**
 * A malformed cursor is rejected here instead of silently returning the first
 * page, so clients notice a broken token immediately.
 */
const postCursorSchema = z
  .string()
  .max(200)
  .transform((value, ctx) => {
    const cursor = decodePostCursor(value)

    if (!cursor) {
      ctx.addIssue({ code: 'custom', message: 'Invalid cursor' })
      return z.NEVER
    }

    return cursor
  })

// Shared by every endpoint that lists posts: a bounded page size plus the
// keyset position that reaches the next page.
export const postPageQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_POST_PAGE_SIZE)
    .default(DEFAULT_POST_PAGE_SIZE),
  cursor: postCursorSchema.optional(),
})

export const listPostsQuerySchema = postPageQuerySchema.extend({
  search: z.string().trim().min(1).max(200).optional(),
  tag: z.string().trim().min(1).max(50).optional(),
})
