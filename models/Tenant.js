const mongoose = require('mongoose');

const TenantSchema = new mongoose.Schema({
  subdomain: {
    type: String,
    unique: true,
    required: true,
    lowercase: true,
    trim: true,
    match: /^[a-z0-9-]+$/
  },
  customDomain: {
    type: String,
    unique: true,
    sparse: true
  },
  schoolName: {
    type: String,
    required: true,
    trim: true
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  settings: {
    branding: {
      logo: String,
      primaryColor: { type: String, default: '#3B82F6' },
      secondaryColor: { type: String, default: '#1E40AF' },
      theme: { type: String, enum: ['light', 'dark'], default: 'light' }
    },
    features: {
      enabled: [String],
      disabled: [String],
      selected: [String] // Features selected during onboarding
    },
    portals: {
      student: { type: Boolean, default: true },
      teacher: { type: Boolean, default: true },
      parent: { type: Boolean, default: false }
    },
    integrations: {
      sms: { enabled: Boolean, provider: String, config: mongoose.Schema.Types.Mixed },
      email: { enabled: Boolean, provider: String, config: mongoose.Schema.Types.Mixed },
      payment: { enabled: Boolean, provider: String, config: mongoose.Schema.Types.Mixed }
    }
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'trial', 'setup_pending'],
    default: 'setup_pending'
  },
  databaseName: {
    type: String,
    required: true,
    unique: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  // Enhanced onboarding tracking
  onboarding: {
    schoolSetupComplete: { type: Boolean, default: false },
    featuresSelected: { type: Boolean, default: false },
    paymentSetupComplete: { type: Boolean, default: false },
    onboardingComplete: { type: Boolean, default: false },
    completedAt: Date,
    currentStep: {
      type: String,
      enum: ['email_verification', 'school_setup', 'feature_selection', 'payment_setup', 'complete'],
      default: 'email_verification'
    }
  },
  // Billing state tracking
  billing: {
    stripeCustomerId: String,
    hasActiveSubscription: { type: Boolean, default: false },
    trialEndsAt: Date,
    selectedPlan: String,
    selectedFeatures: [String],
    monthlyAmount: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// Helper methods
TenantSchema.methods.getOnboardingStep = function() {
  if (!this.onboarding.emailVerificationComplete) return 'email_verification';
  if (!this.onboarding.schoolSetupComplete) return 'school_setup';
  if (!this.onboarding.featuresSelected) return 'feature_selection';
  if (!this.onboarding.paymentSetupComplete) return 'payment_setup';
  return 'complete';
};

TenantSchema.methods.isOnboardingComplete = function() {
  return this.onboarding.onboardingComplete;
};

TenantSchema.methods.requiresPayment = function() {
  return !this.billing.hasActiveSubscription && 
         this.onboarding.featuresSelected && 
         (!this.billing.trialEndsAt || new Date() > this.billing.trialEndsAt);
};

TenantSchema.methods.canAccessFeature = function(feature) {
  if (this.status === 'suspended') return false;
  if (this.billing.hasActiveSubscription) {
    return this.billing.selectedFeatures.includes(feature);
  }
  // During trial, allow basic features
  const trialFeatures = ['students', 'teachers', 'attendance', 'fees'];
  return trialFeatures.includes(feature);
};

TenantSchema.index({ subdomain: 1 });
TenantSchema.index({ customDomain: 1 });
TenantSchema.index({ status: 1 });
TenantSchema.index({ 'onboarding.onboardingComplete': 1 });
TenantSchema.index({ 'billing.hasActiveSubscription': 1 });

module.exports = mongoose.model('Tenant', TenantSchema);