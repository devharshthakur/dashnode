import bcrypt from 'bcryptjs'
import { Types, type HydratedDocument } from 'mongoose'

import { Post, type PostDocument, type PostStatus } from '#models/post'
import { Tag, type TagDocument } from '#models/tag'
import { User, type UserDocument } from '#models/user'
import { generateUniqueSlug, slugify } from '#utils/slug'

// The password every factory stores, so a test that logs in can use this one
// constant instead of threading the plaintext through its own fixtures.
export const TEST_PASSWORD = 'correct-horse-battery'

// Counted per worker process, so two documents in the same run never collide on
// a unique index even when a test asks for two of the same thing.
let created = 0

function nextSuffix(): string {
  created += 1

  return `${process.pid}-${created}`
}

export interface UserOverrides {
  name?: string
  email?: string
  password?: string
  bio?: string
  avatarUrl?: string
}

/** A user whose `email` is unique per call, unless the test pins one. */
export async function createUser(
  overrides: UserOverrides = {},
): Promise<HydratedDocument<UserDocument>> {
  return User.create({
    name: overrides.name ?? 'Test User',
    email: overrides.email ?? `user-${nextSuffix()}@example.com`,
    // `password` is `select: false`, so the hash is what the factory stores and
    // `TEST_PASSWORD` is what a login test types.
    password: await bcrypt.hash(overrides.password ?? TEST_PASSWORD, 10),
    bio: overrides.bio ?? '',
    avatarUrl: overrides.avatarUrl ?? '',
  })
}

export async function createTag(
  name: string,
): Promise<HydratedDocument<TagDocument>> {
  const normalized = name.trim().toLowerCase()
  const existing = await Tag.findOne({ name: normalized })

  if (existing) {
    return existing
  }

  return Tag.create({
    name: normalized,
    slug: await generateUniqueSlug(normalized, Tag),
  })
}

/** Reuses a tag of that name, or creates one — the rule `resolveTagIds` uses. */
export async function createTags(names: string[]): Promise<Types.ObjectId[]> {
  const ids: Types.ObjectId[] = []

  for (const name of names) {
    const tag = await createTag(name)

    ids.push(tag._id)
  }

  return ids
}

export interface PostOverrides {
  title?: string
  slug?: string
  content?: string
  excerpt?: string
  coverImage?: string
  status?: PostStatus
  /** `undefined` stamps a fresh date for a published post and `null` for a draft. */
  publishedAt?: Date | null
  /**
   * `undefined` stamps a fresh date. Mongoose only writes `createdAt` itself
   * while the field is unset, so a test that has to disagree with the order the
   * documents were stored in pins it here rather than updating it afterwards:
   * `createdAt` is immutable and an update would be dropped.
   */
  createdAt?: Date
  tags?: string[]
}

export async function createPost(
  author: HydratedDocument<UserDocument> | Types.ObjectId,
  overrides: PostOverrides = {},
): Promise<HydratedDocument<PostDocument>> {
  const status = overrides.status ?? 'published'
  const title = overrides.title ?? `Post ${nextSuffix()}`
  const publishedAt =
    overrides.publishedAt !== undefined
      ? overrides.publishedAt
      : status === 'published'
        ? new Date()
        : null

  return Post.create({
    title,
    slug: overrides.slug ?? slugify(title),
    content: overrides.content ?? 'Post body.',
    excerpt: overrides.excerpt ?? 'Post body.',
    coverImage: overrides.coverImage ?? '',
    status,
    publishedAt,
    ...(overrides.createdAt === undefined
      ? {}
      : { createdAt: overrides.createdAt }),
    // The `author` column is a reference, so a document has to be reduced to
    // its id first.
    author: author instanceof Types.ObjectId ? author : author._id,
    tags: overrides.tags === undefined ? [] : await createTags(overrides.tags),
  })
}
