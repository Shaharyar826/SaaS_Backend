const mongoose = require('mongoose');

const ParentSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  children: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  }],
  relationship: {
    type: String,
    enum: ['father', 'mother', 'guardian'],
    required: true
  },
  occupation: String,
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

ParentSchema.index({ tenant: 1, user: 1 }, { unique: true });
ParentSchema.index({ tenant: 1, children: 1 });

module.exports = mongoose.model('Parent', ParentSchema);
