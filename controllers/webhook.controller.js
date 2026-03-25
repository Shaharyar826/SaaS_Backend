const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../models/Subscription');
const Tenant = require('../models/Tenant');
const { PLANS } = require('./stripe.controller');

// @desc    Handle Stripe webhooks
// @route   POST /api/webhooks/stripe
// @access  Public (Stripe only)
exports.handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      default:
        // Unhandled event — ignore silently
        break;
    }
    res.json({ received: true });
  } catch (error) {
    console.error(`Webhook handler error [${event.type}]:`, error.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
};

async function handleCheckoutCompleted(session) {
  const { tenantId, plan, interval } = session.metadata || {};
  if (!tenantId || !plan) return;

  const stripeSubscription = await stripe.subscriptions.retrieve(session.subscription);
  const planConfig = PLANS[plan];
  if (!planConfig) return;

  const priceConfig = interval === 'year' ? planConfig.yearly : planConfig.monthly;

  await Subscription.findOneAndUpdate(
    { tenant: tenantId },
    {
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      stripePriceId: priceConfig.priceId,
      plan,
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      limits: planConfig.limits,
      features: planConfig.features,
      billing: { amount: priceConfig.amount, currency: 'usd', interval: interval || 'month' }
    },
    { upsert: true, new: true }
  );

  // Sync customer ID to Tenant
  await Tenant.findByIdAndUpdate(tenantId, {
    'billing.stripeCustomerId': session.customer,
    'billing.hasActiveSubscription': true,
    'billing.selectedPlan': plan
  });
}

async function handlePaymentSucceeded(invoice) {
  if (!invoice.subscription) return;

  const stripeSubscription = await stripe.subscriptions.retrieve(invoice.subscription);

  await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: invoice.subscription },
    {
      status: 'active',
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      'usage.apiCalls': 0 // Reset monthly API call counter
    }
  );
}

async function handleSubscriptionUpdated(stripeSubscription) {
  const update = {
    status: stripeSubscription.status,
    currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    trialEnd: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null
  };

  // If plan changed via portal, sync plan metadata
  const plan = stripeSubscription.metadata?.plan;
  if (plan && PLANS[plan]) {
    update.plan = plan;
    update.limits = PLANS[plan].limits;
    update.features = PLANS[plan].features;
  }

  await Subscription.findOneAndUpdate({ stripeSubscriptionId: stripeSubscription.id }, update);
}

async function handleSubscriptionDeleted(stripeSubscription) {
  await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: stripeSubscription.id },
    { status: 'cancelled', cancelAtPeriodEnd: false }
  );

  // Find tenant and mark subscription inactive
  const subscription = await Subscription.findOne({ stripeSubscriptionId: stripeSubscription.id });
  if (subscription) {
    await Tenant.findByIdAndUpdate(subscription.tenant, { 'billing.hasActiveSubscription': false });
  }
}
