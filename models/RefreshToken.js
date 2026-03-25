const mongoose = require('mongoose');

/**
 * RefreshToken — persists refresh tokens in MongoDB.
 *
 * Stored in the MAIN database (not per-tenant), because token validation
 * happens before tenant context is established.
 *
 * TTL index automatically removes expired documents — no manual cleanup needed.
 */
const RefreshTokenSchema = new mongoose.Schema({
  tokenId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: String, // stored as string to work across tenant DBs
    required: true,
    index: true,
  },
  // Full token hash for revocation lookup (we store SHA-256 hash, not raw token)
  tokenHash: {
    type: String,
    required: true,
    unique: true,
  },
  isRevoked: {
    type: Boolean,
    default: false,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true,
  },
});

// TTL index: MongoDB auto-deletes expired tokens after they expire
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', RefreshTokenSchema);
