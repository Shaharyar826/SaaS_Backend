const mongoose = require('mongoose');
const crypto = require('crypto');

const PasswordResetRequestSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true
  },
  securityAnswers: {
    favoriteColor: String,
    birthCity: String,
    petName: String
  },
  tempPassword: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: Date,
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 86400 // Automatically delete after 24 hours if not processed
  }
});

// Generate a random temporary password
PasswordResetRequestSchema.statics.generateTempPassword = function() {
  // Generate a random 8-character alphanumeric password
  return crypto.randomBytes(4).toString('hex');
};

module.exports = mongoose.model('PasswordResetRequest', PasswordResetRequestSchema);
