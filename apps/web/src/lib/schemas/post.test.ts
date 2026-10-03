import { describe, expect, it } from 'vitest'

import {
  createPostFormSchema,
  parseTagNames,
  toCreatePostInput,
} from '#lib/schemas/post'

import type { CreatePostFormValues } from '#lib/schemas/post'

const validPost: CreatePostFormValues = {
  title: 'Building a REST API with Express',
  content: '# Express\n\nRoutes, services, and a model.',
  tags: 'node, express',
  status: 'draft',
}

/** The first error message of a field, or `undefined` when the form accepts it. */
function errorFor(values: Partial<CreatePostFormValues>, field: string) {
  const parsed = createPostFormSchema.safeParse({ ...validPost, ...values })

  if (parsed.success) {
    return undefined
  }

  return parsed.error.issues.find((issue) => issue.path[0] === field)?.message
}

describe('parseTagNames', () => {
  it('reads a comma-separated field as the tag names the API expects', () => {
    expect(parseTagNames('node, express ,mongodb')).toEqual([
      'node',
      'express',
      'mongodb',
    ])
  })

  it('drops the empty entries a trailing or doubled comma leaves behind', () => {
    expect(parseTagNames('node,,express,')).toEqual(['node', 'express'])
  })

  it('reads an empty field as no tags at all', () => {
    expect(parseTagNames('  ,  ')).toEqual([])
  })
})

describe('createPostFormSchema', () => {
  it('accepts a complete post', () => {
    expect(createPostFormSchema.safeParse(validPost).success).toBe(true)
  })

  it('requires a title, content, and at least one tag', () => {
    expect(errorFor({ title: '   ' }, 'title')).toBe('Enter a title.')
    expect(errorFor({ content: '\n\n' }, 'content')).toBe(
      'Content is required.',
    )
    expect(errorFor({ tags: ' , ' }, 'tags')).toBe('Add at least one tag.')
  })

  it('keeps a title that folds to nothing away before the API sees it', () => {
    expect(errorFor({ title: '!!!' }, 'title')).toBe(
      'Title must contain at least one letter or number.',
    )
  })

  it('counts the tags a field holds rather than the commas in it', () => {
    expect(errorFor({ tags: 'a, b, c, d, e, f, g, h, i, j, k' }, 'tags')).toBe(
      'Use at most 10 tags.',
    )
    expect(errorFor({ tags: 'a, b, c, d, e, f, g, h, i, j' }, 'tags')).toBe(
      undefined,
    )
  })

  it('rejects a tag longer than the API accepts', () => {
    expect(errorFor({ tags: `short, ${'t'.repeat(51)}` }, 'tags')).toBe(
      'Each tag must be at most 50 characters.',
    )
  })

  it('rejects a status the API does not know', () => {
    expect(
      createPostFormSchema.safeParse({ ...validPost, status: 'archived' })
        .success,
    ).toBe(false)
  })
})

describe('toCreatePostInput', () => {
  it('sends the parsed tag names and the chosen status', () => {
    expect(toCreatePostInput(createPostFormSchema.parse(validPost))).toEqual({
      title: 'Building a REST API with Express',
      content: '# Express\n\nRoutes, services, and a model.',
      tags: ['node', 'express'],
      status: 'draft',
    })
  })

  it('keeps the Markdown body exactly as it was typed', () => {
    const content = '  indented code\n\n    deeper\n'
    const input = toCreatePostInput(
      createPostFormSchema.parse({ ...validPost, content }),
    )

    expect(input.content).toBe(content)
  })
})
