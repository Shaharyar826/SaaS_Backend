const mongoose = require('mongoose');

const UsageTrackingSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  metrics: {
    students: { type: Number, default: 0 },
    teachers: { type: Number, default: 0 },
    storage: { type: Number, default: 0 }, // MB
    apiCalls: { type: Number, default: 0 },
    smsCount: { type: Number, default: 0 },
    emailCount: { type: Number, default: 0 }
  },
  period: {
    type: String,
    enum: ['daily', 'monthly'],
    default: 'daily'
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
UsageTrackingSchema.index({ tenant: 1, date: 1, period: 1 });

module.exports = mongoose.model('UsageTracking', UsageTrackingSchema);