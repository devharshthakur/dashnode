import { Schema, model } from 'mongoose'

export interface UserDocument {
  name: string
  email: string
  password: string
  bio: string
  avatarUrl: string
}

const userSchema = new Schema<UserDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // bcryptjs hash; select:false keeps hashes out of normal query results
    password: {
      type: String,
      required: true,
      select: false,
    },
    bio: {
      type: String,
      default: '',
      maxlength: 200,
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true },
)

export const User = model<UserDocument>('User', userSchema)
