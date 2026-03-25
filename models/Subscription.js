const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true,
    unique: true
  },
  stripeCustomerId: {
    type: String,
    required: false,
    unique: true,
    sparse: true
  },
  stripeSubscriptionId: {
    type: String,
    unique: true,
    sparse: true
  },
  stripePriceId: {
    type: String
  },
  plan: {
    type: String,
    enum: ['trial', 'starter', 'professional', 'enterprise', 'district'],
    default: 'trial'
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'past_due', 'unpaid', 'trialing'],
    default: 'trialing'
  },
  currentPeriodStart: {
    type: Date,
    required: true
  },
  currentPeriodEnd: {
    type: Date,
    required: true
  },
  trialEnd: Date,
  trialDays: { type: Number, default: 7 },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false
  },
  usage: {
    students: { type: Number, default: 0 },
    teachers: { type: Number, default: 0 },
    storage: { type: Number, default: 0 }, // MB
    apiCalls: { type: Number, default: 0 }
  },
  limits: {
    maxStudents: { type: Number, default: 100 },
    maxTeachers: { type: Number, default: 5 },
    maxStorage: { type: Number, default: 500 },
    maxApiCalls: { type: Number, default: 5000 }
  },
  features: [{
    type: String,
    enum: [
      'basic_attendance', 'advanced_attendance', 'biometric_attendance',
      'simple_fees', 'fee_receipts', 'bulk_fees',
      'parent_portal', 'sms_notifications', 'email_notifications',
      'basic_reports', 'analytics', 'custom_reports',
      'bulk_operations', 'custom_branding', 'api_access',
      'integrations', 'multi_campus', 'white_label', 'sso'
    ]
  }],
  billing: {
    amount: { type: Number, default: 0 }, // cents
    currency: { type: String, default: 'usd' },
    interval: { type: String, enum: ['month', 'year'], default: 'month' }
  }
}, {
  timestamps: true
});

// Indexes for performance
SubscriptionSchema.index({ tenant: 1 });
SubscriptionSchema.index({ stripeCustomerId: 1 });
SubscriptionSchema.index({ stripeSubscriptionId: 1 });
SubscriptionSchema.index({ status: 1 });
SubscriptionSchema.index({ currentPeriodEnd: 1 });

// Methods
SubscriptionSchema.methods.hasFeature = function(feature) {
  return this.features.includes(feature);
};

SubscriptionSchema.methods.isWithinLimit = function(resource, count) {
  const limit = this.limits[`max${resource.charAt(0).toUpperCase() + resource.slice(1)}`];
  return limit === -1 || count < limit;
};

SubscriptionSchema.methods.isActive = function() {
  return ['active', 'trialing'].includes(this.status) && 
         new Date() < this.currentPeriodEnd;
};

module.exports = mongoose.model('Subscription', SubscriptionSchema);