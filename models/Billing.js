const mongoose = require('mongoose');

const BillingSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  billingPeriod: {
    month: { type: Number, required: true }, // 1-12
    year: { type: Number, required: true }
  },
  studentCount: {
    type: Number,
    required: true,
    min: 0
  },
  enabledFeatures: [{
    feature: { type: String, required: true },
    price: { type: Number, required: true },
    cost: { type: Number, required: true } // price * studentCount
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'overdue', 'cancelled'],
    default: 'pending'
  },
  stripeInvoiceId: String,
  paidAt: Date,
  dueDate: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Compound index for efficient queries
BillingSchema.index({ tenant: 1, 'billingPeriod.year': 1, 'billingPeriod.month': 1 }, { unique: true });
BillingSchema.index({ status: 1, dueDate: 1 });

module.exports = mongoose.model('Billing', BillingSchema);