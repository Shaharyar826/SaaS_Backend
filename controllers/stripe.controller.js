const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../models/Subscription');
const Tenant = require('../models/Tenant');
const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

// Plan config with monthly + yearly price IDs
const PLANS = {
  starter: {
    name: 'Starter',
    monthly: { priceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID, amount: 2900 },
    yearly:  { priceId: process.env.STRIPE_STARTER_YEARLY_PRICE_ID,  amount: 29000 },
    limits: { maxStudents: 100, maxTeachers: 5, maxStorage: 500, maxApiCalls: 5000 },
    features: ['basic_attendance', 'simple_fees', 'email_notifications', 'basic_reports'],
    popular: false
  },
  professional: {
    name: 'Professional',
    monthly: { priceId: process.env.STRIPE_PROFESSIONAL_MONTHLY_PRICE_ID, amount: 7900 },
    yearly:  { priceId: process.env.STRIPE_PROFESSIONAL_YEARLY_PRICE_ID,  amount: 79000 },
    limits: { maxStudents: 500, maxTeachers: 25, maxStorage: 2000, maxApiCalls: 25000 },
    features: ['advanced_attendance', 'bulk_operations', 'parent_portal', 'sms_notifications', 'analytics'],
    popular: true
  },
  enterprise: {
    name: 'Enterprise',
    monthly: { priceId: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID, amount: 19900 },
    yearly:  { priceId: process.env.STRIPE_ENTERPRISE_YEARLY_PRICE_ID,  amount: 199000 },
    limits: { maxStudents: -1, maxTeachers: -1, maxStorage: -1, maxApiCalls: -1 },
    features: ['custom_branding', 'api_access', 'integrations', 'custom_reports', 'sso'],
    popular: false
  }
};

const TRIAL_DAYS = 7;

// @desc    Get Stripe configuration
// @route   GET /api/stripe/config
// @access  Public
exports.getStripeConfig = asyncHandler(async (req, res) => {
  res.json({ 
    success: true, 
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY 
  });
});

// @desc    Get available plans
// @route   GET /api/subscription/plans
// @access  Public
exports.getPlans = asyncHandler(async (req, res) => {
  res.json({ success: true, plans: PLANS, trialDays: TRIAL_DAYS });
});

// @desc    Get current subscription
// @route   GET /api/subscription
// @access  Private
exports.getSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({ tenant: req.tenantId });
  if (!subscription) {
    return res.status(404).json({ success: false, message: 'No subscription found' });
  }

  // Auto-expire trial
  if (subscription.status === 'trialing' && subscription.trialEnd && new Date() > subscription.trialEnd) {
    subscription.status = 'cancelled';
    await subscription.save();
  }

  res.json({
    success: true,
    subscription: {
      plan: subscription.plan,
      status: subscription.status,
      currentPeriodEnd: subscription.currentPeriodEnd,
      trialEnd: subscription.trialEnd,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      limits: subscription.limits,
      features: subscription.features,
      billing: subscription.billing
    },
    usage: subscription.usage
  });
});

// @desc    Create Stripe Checkout Session
// @route   POST /api/subscription/create-checkout-session
// @access  Private (admin/principal)
exports.createCheckoutSession = asyncHandler(async (req, res) => {
  if (!['admin', 'principal'].includes(req.user.role)) {
    return next(new ErrorResponse('Not authorized to manage subscriptions', 403));
  }

  const { plan, interval = 'month', successUrl, cancelUrl } = req.body;

  if (!PLANS[plan]) {
    return res.status(400).json({ success: false, message: 'Invalid plan selected' });
  }

  const planConfig = PLANS[plan];
  const priceConfig = interval === 'year' ? planConfig.yearly : planConfig.monthly;

  if (!priceConfig.priceId) {
    return res.status(400).json({ success: false, message: `Price ID not configured for ${plan} ${interval}` });
  }

  const tenant = await Tenant.findById(req.tenantId);
  if (!tenant) return res.status(404).json({ success: false, message: 'Tenant not found' });

  // Ensure Stripe customer exists
  let customerId = tenant.billing?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: req.user.email,
      metadata: { tenantId: req.tenantId.toString(), subdomain: tenant.subdomain }
    });
    customerId = customer.id;
    await Tenant.findByIdAndUpdate(req.tenantId, { 'billing.stripeCustomerId': customerId });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ['card'],
    line_items: [{ price: priceConfig.priceId, quantity: 1 }],
    mode: 'subscription',
    subscription_data: {
      trial_period_days: TRIAL_DAYS,
      metadata: { tenantId: req.tenantId.toString(), plan, interval }
    },
    success_url: successUrl || `${process.env.FRONTEND_URL}/subscription?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${process.env.FRONTEND_URL}/subscription?canceled=true`,
    metadata: { tenantId: req.tenantId.toString(), plan, interval }
  });

  res.json({ success: true, sessionId: session.id, url: session.url });
});

// @desc    Create Stripe Billing Portal Session
// @route   POST /api/subscription/create-portal-session
// @access  Private (admin/principal)
exports.createPortalSession = asyncHandler(async (req, res) => {
  if (!['admin', 'principal'].includes(req.user.role)) {
    return next(new ErrorResponse('Not authorized to manage billing', 403));
  }

  const { returnUrl } = req.body;
  const tenant = await Tenant.findById(req.tenantId);

  if (!tenant?.billing?.stripeCustomerId) {
    return res.status(404).json({ success: false, message: 'No billing account found. Please subscribe first.' });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.billing.stripeCustomerId,
    return_url: returnUrl || `${process.env.FRONTEND_URL}/subscription`
  });

  res.json({ success: true, url: session.url });
});

exports.PLANS = PLANS;
exports.TRIAL_DAYS = TRIAL_DAYS;
