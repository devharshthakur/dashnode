import { Schema, model } from 'mongoose'

export interface TagDocument {
  name: string
  slug: string
}

const tagSchema = new Schema<TagDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
  },
  { timestamps: true },
)

export const Tag = model<TagDocument>('Tag', tagSchema)
