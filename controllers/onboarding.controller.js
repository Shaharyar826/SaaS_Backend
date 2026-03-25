const express = require('express');
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const stripeService = require('../services/stripeService');
const { protect } = require('../middleware/auth');
const { extractTenant, switchTenantDB } = require('../middleware/tenant');
const asyncHandler = require('../middleware/async');

// @desc    Complete school setup step
// @route   POST /api/onboarding/complete-school-setup
// @access  Private
exports.completeSchoolSetup = asyncHandler(async (req, res, next) => {
  const { schoolDetails, preferences } = req.body;
  
  const tenant = await Tenant.findByIdAndUpdate(
    req.tenantId,
    {
      'onboarding.schoolSetupComplete': true,
      'onboarding.currentStep': 'feature_selection',
      'settings.preferences': preferences,
      schoolName: schoolDetails.name || req.tenant.schoolName
    },
    { new: true }
  );

  res.json({
    success: true,
    message: 'School setup completed successfully',
    data: {
      tenant: {
        id: tenant._id,
        onboardingStep: tenant.getOnboardingStep(),
        schoolSetupComplete: tenant.onboarding.schoolSetupComplete
      }
    }
  });
});

const { FEATURE_PRICING, calculateMonthlyBilling } = require('../config/pricing');

// Helper function to calculate pricing
const calculatePricing = (selectedFeatures, selectedPlan = 'starter', studentCount = 50) => {
  // Use the real pricing config with per-student pricing
  const totalCost = calculateMonthlyBilling(studentCount, selectedFeatures);
  
  const planMultipliers = {
    starter: 1,
    professional: 0.9,
    enterprise: 0.8
  };

  const multiplier = planMultipliers[selectedPlan] || 1;
  const finalTotal = Math.round(totalCost * multiplier * 100) / 100; // Round to 2 decimals

  const breakdown = selectedFeatures.map(feature => {
    const featureConfig = FEATURE_PRICING[feature.toUpperCase()];
    const basePrice = featureConfig ? featureConfig.price * studentCount : 0;
    return {
      feature,
      basePrice,
      finalPrice: Math.round(basePrice * multiplier * 100) / 100
    };
  });

  return {
    total: finalTotal,
    breakdown,
    discount: selectedPlan !== 'starter' ? Math.round((totalCost - finalTotal) * 100) / 100 : 0
  };
};

// @desc    Complete feature selection step
// @route   POST /api/onboarding/select-features
// @access  Private
exports.selectFeatures = asyncHandler(async (req, res, next) => {
  const { selectedFeatures, selectedPlan, studentCount = 50 } = req.body;
  
  if (!selectedFeatures || selectedFeatures.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please select at least one feature'
    });
  }

  // Calculate pricing based on selected features and student count
  const pricing = calculatePricing(selectedFeatures, selectedPlan, studentCount);
  
  const tenant = await Tenant.findByIdAndUpdate(
    req.tenantId,
    {
      'onboarding.featuresSelected': true,
      'onboarding.currentStep': 'payment_setup',
      'settings.features.selected': selectedFeatures,
      'billing.selectedPlan': selectedPlan,
      'billing.selectedFeatures': selectedFeatures,
      'billing.monthlyAmount': pricing.total,
      'settings.studentLimit': studentCount
    },
    { new: true }
  );

  res.json({
    success: true,
    message: 'Features selected successfully',
    data: {
      tenant: {
        id: tenant._id,
        onboardingStep: tenant.getOnboardingStep(),
        featuresSelected: tenant.onboarding.featuresSelected
      },
      pricing: {
        selectedFeatures,
        selectedPlan,
        monthlyAmount: pricing.total,
        breakdown: pricing.breakdown
      },
      nextStep: 'payment_setup'
    }
  });
});

// Helper function to get currency by country
const getCurrencyByCountry = (countryCode) => {
  const currencyMap = {
    'US': 'usd', 'CA': 'cad', 'GB': 'gbp', 'EU': 'eur', 'DE': 'eur', 'FR': 'eur', 'IT': 'eur', 'ES': 'eur',
    'IN': 'inr', 'PK': 'pkr', 'BD': 'bdt', 'AU': 'aud', 'NZ': 'nzd', 'JP': 'jpy', 'CN': 'cny',
    'SG': 'sgd', 'HK': 'hkd', 'MY': 'myr', 'TH': 'thb', 'ID': 'idr', 'PH': 'php', 'VN': 'vnd',
    'AE': 'aed', 'SA': 'sar', 'EG': 'egp', 'ZA': 'zar', 'NG': 'ngn', 'KE': 'kes', 'BR': 'brl',
    'MX': 'mxn', 'AR': 'ars', 'CL': 'clp', 'CO': 'cop', 'PE': 'pen', 'RU': 'rub', 'TR': 'try'
  };
  return currencyMap[countryCode] || 'usd';
};

// @desc    Create Stripe checkout session for onboarding
// @route   POST /api/onboarding/create-checkout-session
// @access  Private
exports.createCheckoutSession = asyncHandler(async (req, res, next) => {
  const tenant = await Tenant.findById(req.tenantId);
  
  if (!tenant.onboarding.featuresSelected) {
    return res.status(400).json({
      success: false,
      message: 'Please complete feature selection first'
    });
  }

  if (!tenant.billing.selectedFeatures || tenant.billing.selectedFeatures.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No features selected for billing'
    });
  }

  try {
    // Create or get Stripe customer
    let stripeCustomerId = tenant.billing.stripeCustomerId;
    
    if (!stripeCustomerId) {
      const customer = await stripeService.createCustomer(tenant, req.user.email);
      stripeCustomerId = customer.id;
      
      await Tenant.findByIdAndUpdate(req.tenantId, {
        'billing.stripeCustomerId': stripeCustomerId
      });
    }

    // Auto-detect currency from user's country
    let currency = 'usd'; // default
    const userCountry = req.headers['cf-ipcountry'] || req.headers['x-country'] || 
                       req.get('CF-IPCountry') || req.get('X-Country');
    if (userCountry) {
      currency = getCurrencyByCountry(userCountry.toUpperCase());
    }

    // Create checkout session
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const session = await stripeService.createCheckoutSession({
      customerId: stripeCustomerId,
      tenantId: req.tenantId,
      selectedFeatures: tenant.billing.selectedFeatures,
      selectedPlan: tenant.billing.selectedPlan,
      monthlyAmount: tenant.billing.monthlyAmount,
      currency: currency,
      successUrl: `${frontendUrl}/subscription/success?session_id={CHECKOUT_SESSION_ID}&tenant=${tenant.subdomain}`,
      cancelUrl: `${frontendUrl}/setup?step=payment&tenant=${tenant.subdomain}`
    });

    res.json({
      success: true,
      data: {
        sessionId: session.id,
        checkoutUrl: session.url
      }
    });

  } catch (error) {
    console.error('Stripe checkout session creation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create checkout session'
    });
  }
});

// @desc    Handle successful payment and complete onboarding
// @route   POST /api/onboarding/complete-payment
// @access  Private
exports.completePayment = asyncHandler(async (req, res, next) => {
  const { sessionId } = req.body;
  
  try {
    // Verify session with Stripe
    const session = await stripeService.getCheckoutSession(sessionId);
    
    if (session.payment_status !== 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Payment not completed'
      });
    }

    // Update tenant with completed onboarding
    const tenant = await Tenant.findByIdAndUpdate(
      req.tenantId,
      {
        'onboarding.paymentSetupComplete': true,
        'onboarding.onboardingComplete': true,
        'onboarding.completedAt': new Date(),
        'onboarding.currentStep': 'complete',
        'billing.hasActiveSubscription': true,
        status: 'active'
      },
      { new: true }
    );

    // Update subscription
    await Subscription.findOneAndUpdate(
      { tenant: req.tenantId },
      {
        status: 'active',
        stripeCustomerId: tenant.billing.stripeCustomerId,
        features: tenant.billing.selectedFeatures,
        'billing.amount': tenant.billing.monthlyAmount * 100, // Convert to cents
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      }
    );

    res.json({
      success: true,
      message: 'Onboarding completed successfully! Welcome to your school management system.',
      data: {
        tenant: {
          id: tenant._id,
          onboardingComplete: tenant.onboarding.onboardingComplete,
          hasActiveSubscription: tenant.billing.hasActiveSubscription
        },
        redirectTo: '/dashboard'
      }
    });

  } catch (error) {
    console.error('Payment completion failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete payment setup'
    });
  }
});

// @desc    Get onboarding status
// @route   GET /api/onboarding/status
// @access  Private
exports.getOnboardingStatus = asyncHandler(async (req, res, next) => {
  const tenant = req.tenant;
  
  res.json({
    success: true,
    data: {
      tenant: {
        id: tenant._id,
        subdomain: tenant.subdomain,
        schoolName: tenant.schoolName,
        status: tenant.status,
        onboarding: {
          currentStep: tenant.getOnboardingStep(),
          schoolSetupComplete: tenant.onboarding.schoolSetupComplete,
          featuresSelected: tenant.onboarding.featuresSelected,
          paymentSetupComplete: tenant.onboarding.paymentSetupComplete,
          onboardingComplete: tenant.onboarding.onboardingComplete
        },
        billing: {
          hasActiveSubscription: tenant.billing.hasActiveSubscription,
          selectedFeatures: tenant.billing.selectedFeatures,
          selectedPlan: tenant.billing.selectedPlan,
          monthlyAmount: tenant.billing.monthlyAmount,
          requiresPayment: tenant.requiresPayment()
        }
      }
    }
  });
});

// @desc    Skip onboarding (for development/testing)
// @route   POST /api/onboarding/skip
// @access  Private
exports.skipOnboarding = asyncHandler(async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Onboarding cannot be skipped in production'
    });
  }

  const tenant = await Tenant.findByIdAndUpdate(
    req.tenantId,
    {
      'onboarding.schoolSetupComplete': true,
      'onboarding.featuresSelected': true,
      'onboarding.paymentSetupComplete': true,
      'onboarding.onboardingComplete': true,
      'onboarding.completedAt': new Date(),
      'onboarding.currentStep': 'complete',
      'billing.hasActiveSubscription': true,
      'billing.selectedFeatures': ['students', 'teachers', 'attendance', 'fees'],
      status: 'active'
    },
    { new: true }
  );

  res.json({
    success: true,
    message: 'Onboarding skipped successfully',
    data: {
      tenant: {
        id: tenant._id,
        onboardingComplete: tenant.onboarding.onboardingComplete
      },
      redirectTo: '/dashboard'
    }
  });
});

// @desc    Complete setup with student limit
// @route   POST /api/onboarding/complete-setup
// @access  Private
exports.completeSetup = asyncHandler(async (req, res, next) => {
  const { modules, structure, preferences, studentCount, portals } = req.body;
  
  const tenant = await Tenant.findByIdAndUpdate(
    req.tenantId,
    {
      'onboarding.onboardingComplete': true,
      'onboarding.completedAt': new Date(),
      'settings.features.enabled': modules,
      'settings.structure': structure,
      'settings.preferences': preferences,
      'settings.studentLimit': studentCount || 50,
      'settings.portals': portals || { student: true, teacher: true, parent: false },
      status: 'active'
    },
    { new: true }
  );

  res.json({
    success: true,
    message: 'Setup completed successfully',
    data: {
      tenant: {
        id: tenant._id,
        onboardingComplete: tenant.onboarding.onboardingComplete,
        studentLimit: tenant.settings.studentLimit,
        portals: tenant.settings.portals
      }
    },
    redirectTo: '/dashboard'
  });
});
module.exports = {
  completeSchoolSetup: exports.completeSchoolSetup,
  selectFeatures: exports.selectFeatures,
  createCheckoutSession: exports.createCheckoutSession,
  completePayment: exports.completePayment,
  getOnboardingStatus: exports.getOnboardingStatus,
  skipOnboarding: exports.skipOnboarding,
  completeSetup: exports.completeSetup
};