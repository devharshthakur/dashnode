import { Schema, model } from 'mongoose'

export interface RevokedTokenDocument {
  /** JWT ID (`jti`, RFC 7519) of the revoked session token. */
  jti: string
  expiresAt: Date
}

const revokedTokenSchema = new Schema<RevokedTokenDocument>({
  jti: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
})

// TTL: drop entries once the revoked token would have expired anyway.
revokedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const RevokedToken = model<RevokedTokenDocument>(
  'RevokedToken',
  revokedTokenSchema,
)
