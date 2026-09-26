import { Schema, model } from 'mongoose'
import type { Types } from 'mongoose'

export const POST_STATUSES = ['draft', 'published'] as const
export type PostStatus = (typeof POST_STATUSES)[number]

export interface PostDocument {
  title: string
  slug: string
  content: string
  excerpt: string
  coverImage: string
  status: PostStatus
  publishedAt: Date | null
  author: Types.ObjectId
  tags: Types.ObjectId[]
  createdAt: Date
  updatedAt: Date
}

const postSchema = new Schema<PostDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    excerpt: {
      type: String,
      default: '',
      maxlength: 250,
    },
    coverImage: {
      type: String,
      default: '',
      trim: true,
    },
    status: {
      type: String,
      enum: POST_STATUSES,
      default: 'draft',
      required: true,
    },
    // Stamped when the post enters `published`; null while it is a draft.
    publishedAt: {
      type: Date,
      default: null,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    tags: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Tag',
      },
    ],
  },
  { timestamps: true },
)

// Public feed and tag feeds: most recently published first. `_id` settles
// keyset pagination ties and lets one index satisfy the full sort.
postSchema.index({ status: 1, publishedAt: -1, _id: -1 })
postSchema.index({ tags: 1, status: 1, publishedAt: -1, _id: -1 })
// Public profile: one author's published posts in feed order
postSchema.index({ author: 1, status: 1, publishedAt: -1, _id: -1 })
// Dashboard: one author's posts (drafts + published), newest first
postSchema.index({ author: 1, createdAt: -1, _id: -1 })
// Title keyword search over published posts
postSchema.index({ title: 'text' })

export const Post = model<PostDocument>('Post', postSchema)
