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
  author: Types.ObjectId
  tags: Types.ObjectId[]
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
      trim: true,
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

// Public feed: newest-first published posts
postSchema.index({ status: 1, createdAt: -1 })
// Dashboard: current user's posts (drafts + published)
postSchema.index({ author: 1, status: 1 })
// Title keyword search over published posts
postSchema.index({ title: 'text' })

export const Post = model<PostDocument>('Post', postSchema)
