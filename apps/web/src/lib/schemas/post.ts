import { z } from 'zod'

import type { CreatePostInput } from '@packages/shared'

// Mirrors the rules the API enforces on `POST /posts` bodies
// (apps/api/src/schemas/post.ts). The API stays the authority: this only spares
// a round trip on what a form can decide on its own, and a value it lets
// through is still checked again server-side.
const MAX_TITLE_LENGTH = 200
const MAX_TAGS = 10
const MAX_TAG_LENGTH = 50

// Any title the API accepts has to fold to a usable slug, which needs at least
// one letter or number. Checking only that is deliberately looser than the
// API's slugifier: it never rejects a title the API would take, and the cases
// only the API can see (a title whose letters have no ASCII form) still come
// back as its own message.
const titleSchema = z
  .string()
  .trim()
  .min(1, 'Enter a title.')
  .max(
    MAX_TITLE_LENGTH,
    `Title must be at most ${MAX_TITLE_LENGTH} characters.`,
  )
  .refine((value) => /[\p{L}\p{N}]/u.test(value), {
    error: 'Title must contain at least one letter or number.',
  })

// Not trimmed: leading indentation is meaningful in Markdown, and the API stores
// the body exactly as it was sent.
const contentSchema = z
  .string()
  .refine((value) => value.trim().length > 0, { error: 'Content is required.' })

/** Splits the comma-separated field into the tag names the API expects. */
export function parseTagNames(value: string): string[] {
  return value
    .split(',')
    .map((name) => name.trim())
    .filter((name) => name.length > 0)
}

// One text field, checked against the array it becomes, so the visitor is told
// about too many or too long tags while they are still typing — and about a
// field holding nothing but commas, which trims to a character yet names no tag
// at all.
const tagsSchema = z
  .string()
  .trim()
  .refine((value) => parseTagNames(value).length >= 1, {
    error: 'Add at least one tag.',
  })
  .refine((value) => parseTagNames(value).length <= MAX_TAGS, {
    error: `Use at most ${MAX_TAGS} tags.`,
  })
  .refine(
    (value) =>
      parseTagNames(value).every((name) => name.length <= MAX_TAG_LENGTH),
    { error: `Each tag must be at most ${MAX_TAG_LENGTH} characters.` },
  )

export const createPostFormSchema = z.object({
  title: titleSchema,
  content: contentSchema,
  tags: tagsSchema,
  status: z.enum(['draft', 'published']),
})

export type CreatePostFormValues = z.infer<typeof createPostFormSchema>

/** The validated form values as a `POST /posts` body. */
export function toCreatePostInput(
  values: CreatePostFormValues,
): CreatePostInput {
  return {
    title: values.title,
    content: values.content,
    tags: parseTagNames(values.tags),
    status: values.status,
  }
}
