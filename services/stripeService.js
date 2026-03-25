const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Subscription = require('../models/Subscription');
const Tenant = require('../models/Tenant');

// Pricing configuration
const PRICING_PLANS = {
  starter: {
    priceId: process.env.STRIPE_STARTER_PRICE_ID,
    amount: 2900, // $29/month
    limits: { maxStudents: 100, maxTeachers: 5, maxStorage: 500, maxApiCalls: 5000 },
    features: ['basic_attendance', 'simple_fees', 'email_notifications', 'basic_reports']
  },
  professional: {
    priceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID,
    amount: 7900, // $79/month
    limits: { maxStudents: 500, maxTeachers: 25, maxStorage: 2000, maxApiCalls: 25000 },
    features: ['advanced_attendance', 'bulk_operations', 'parent_portal', 'sms_notifications', 'analytics']
  },
  enterprise: {
    priceId: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    amount: 19900, // $199/month
    limits: { maxStudents: -1, maxTeachers: -1, maxStorage: -1, maxApiCalls: -1 },
    features: ['custom_branding', 'api_access', 'integrations', 'custom_reports', 'sso']
  },
  district: {
    priceId: process.env.STRIPE_DISTRICT_PRICE_ID,
    amount: 49900, // $499/month
    limits: { maxStudents: -1, maxTeachers: -1, maxStorage: -1, maxApiCalls: -1 },
    features: ['multi_campus', 'white_label', 'custom_integrations', 'dedicated_support']
  }
};

class StripeService {
  // Create customer
  async createCustomer(tenant, email) {
    try {
      const customer = await stripe.customers.create({
        email,
        metadata: {
          tenantId: tenant._id.toString(),
          subdomain: tenant.subdomain
        }
      });
      return customer;
    } catch (error) {
      console.error('Stripe createCustomer error:', error);
      throw new Error('Failed to create customer');
    }
  }

  // Create subscription
  async createSubscription(customerId, plan) {
    try {
      const planConfig = PRICING_PLANS[plan];
      if (!planConfig) throw new Error('Invalid plan');

      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: planConfig.priceId }],
        trial_period_days: 14,
        metadata: { plan }
      });

      return subscription;
    } catch (error) {
      console.error('Stripe createSubscription error:', error);
      throw new Error('Failed to create subscription');
    }
  }

  // Update subscription
  async updateSubscription(subscriptionId, newPlan) {
    try {
      const planConfig = PRICING_PLANS[newPlan];
      if (!planConfig) throw new Error('Invalid plan');

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      
      await stripe.subscriptions.update(subscriptionId, {
        items: [{
          id: subscription.items.data[0].id,
          price: planConfig.priceId
        }],
        metadata: { plan: newPlan }
      });

      return subscription;
    } catch (error) {
      console.error('Stripe updateSubscription error:', error);
      throw new Error('Failed to update subscription');
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId) {
    try {
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    } catch (error) {
      console.error('Stripe cancelSubscription error:', error);
      throw new Error('Failed to cancel subscription');
    }
  }

  // Create checkout session
  async createCheckoutSession(options) {
    try {
      const {
        customerId,
        tenantId,
        selectedFeatures,
        selectedPlan = 'starter',
        monthlyAmount,
        successUrl,
        cancelUrl,
        currency = 'usd' // Default to USD, can be overridden
      } = options;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: 'subscription',
        line_items: [{
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: 'School Management System',
              description: `Features: ${selectedFeatures.join(', ')}`
            },
            unit_amount: Math.round(monthlyAmount * 100), // Convert to cents
            recurring: {
              interval: 'month'
            }
          },
          quantity: 1
        }],
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            tenantId: tenantId.toString(),
            selectedFeatures: selectedFeatures.join(','),
            selectedPlan
          }
        },
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          tenantId: tenantId.toString(),
          selectedPlan
        }
      });

      return session;
    } catch (error) {
      console.error('Stripe createCheckoutSession error:', error);
      throw new Error('Failed to create checkout session');
    }
  }

  // Get checkout session
  async getCheckoutSession(sessionId) {
    try {
      return await stripe.checkout.sessions.retrieve(sessionId);
    } catch (error) {
      console.error('Stripe getCheckoutSession error:', error);
      throw new Error('Failed to retrieve checkout session');
    }
  }
  async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
    try {
      return await stripe.paymentIntents.create({
        amount,
        currency,
        metadata
      });
    } catch (error) {
      console.error('Stripe createPaymentIntent error:', error);
      throw new Error('Failed to create payment intent');
    }
  }

  // Handle webhook events
  async handleWebhook(event) {
    try {
      switch (event.type) {
        case 'customer.subscription.created':
          await this.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.handleSubscriptionUpdated(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.handleSubscriptionDeleted(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.handlePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handlePaymentFailed(event.data.object);
          break;
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }
    } catch (error) {
      console.error('Webhook handling error:', error);
      throw error;
    }
  }

  async handleSubscriptionCreated(stripeSubscription) {
    const tenant = await Tenant.findOne({
      'subscription.stripeCustomerId': stripeSubscription.customer
    });

    if (tenant) {
      const plan = stripeSubscription.metadata.plan;
      const planConfig = PRICING_PLANS[plan];

      await Subscription.findOneAndUpdate(
        { tenant: tenant._id },
        {
          stripeSubscriptionId: stripeSubscription.id,
          plan,
          status: stripeSubscription.status,
          currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
          limits: planConfig.limits,
          features: planConfig.features,
          billing: {
            amount: planConfig.amount,
            currency: 'usd',
            interval: 'month'
          }
        }
      );
    }
  }

  async handleSubscriptionUpdated(stripeSubscription) {
    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: stripeSubscription.id },
      {
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
      }
    );
  }

  async handleSubscriptionDeleted(stripeSubscription) {
    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: stripeSubscription.id },
      { status: 'cancelled' }
    );
  }

  async handlePaymentSucceeded(invoice) {
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: invoice.subscription
    });

    if (subscription) {
      await Subscription.findByIdAndUpdate(subscription._id, {
        status: 'active',
        'usage.apiCalls': 0 // Reset monthly usage
      });
    }
  }

  async handlePaymentFailed(invoice) {
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: invoice.subscription
    });

    if (subscription) {
      await Subscription.findByIdAndUpdate(subscription._id, {
        status: 'past_due'
      });
    }
  }

  // Track usage for billing
  async trackUsage(tenantId, resource, amount = 1) {
    try {
      const subscription = await Subscription.findOne({ tenant: tenantId });
      
      if (!subscription) {
        console.warn(`No subscription found for tenant ${tenantId}`);
        return;
      }

      const updateField = `usage.${resource}`;
      await Subscription.findByIdAndUpdate(
        subscription._id,
        { $inc: { [updateField]: amount } }
      );

      const currentUsage = (subscription.usage?.[resource] || 0) + amount;
      const limit = subscription.limits?.[`max${resource.charAt(0).toUpperCase() + resource.slice(1)}`];
      
      if (limit > 0 && currentUsage >= limit * 0.8) {
        console.log(`Usage alert: ${resource} at ${(currentUsage/limit*100).toFixed(1)}% for tenant ${tenantId}`);
      }
    } catch (error) {
      console.error('Failed to track usage:', error);
    }
  }

  // Get pricing plans
  getPricingPlans() {
    return PRICING_PLANS;
  }

  // Get payment methods
  async getPaymentMethods(customerId) {
    try {
      const paymentMethods = await stripe.paymentMethods.list({
        customer: customerId,
        type: 'card'
      });
      return paymentMethods.data;
    } catch (error) {
      console.error('Failed to get payment methods:', error);
      return [];
    }
  }

  // Get invoices
  async getInvoices(customerId) {
    try {
      const invoices = await stripe.invoices.list({
        customer: customerId,
        limit: 20
      });
      return invoices.data;
    } catch (error) {
      console.error('Failed to get invoices:', error);
      return [];
    }
  }
}

module.exports = new StripeService();