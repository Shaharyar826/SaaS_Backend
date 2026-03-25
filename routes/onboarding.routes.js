const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const User = require('../models/User');
const stripeService = require('../services/stripeService');
const { protect } = require('../middleware/auth');
const { extractTenant, switchTenantDB } = require('../middleware/tenant');
const {
  completeSchoolSetup,
  selectFeatures,
  createCheckoutSession,
  completePayment,
  getOnboardingStatus,
  skipOnboarding,
  completeSetup
} = require('../controllers/onboarding.controller');

// Import controller functions
router.post('/complete-school-setup', extractTenant, switchTenantDB, protect, completeSchoolSetup);
router.post('/select-features', extractTenant, switchTenantDB, protect, selectFeatures);
router.post('/create-checkout-session', extractTenant, switchTenantDB, protect, createCheckoutSession);
router.post('/complete-payment', extractTenant, switchTenantDB, protect, completePayment);
router.post('/skip', extractTenant, switchTenantDB, protect, skipOnboarding);

// @desc    Check subdomain availability
// @route   GET /api/onboarding/check-subdomain/:subdomain
// @access  Public
router.get('/check-subdomain/:subdomain', async (req, res) => {
  try {
    const { subdomain } = req.params;
    
    // Validate subdomain format
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return res.status(400).json({
        success: false,
        message: 'Subdomain can only contain lowercase letters, numbers, and hyphens'
      });
    }

    const existingTenant = await Tenant.findOne({ subdomain });
    
    res.json({
      success: true,
      available: !existingTenant
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Complete onboarding setup
// @route   POST /api/onboarding/complete-setup
// @access  Private
router.post('/complete-setup', extractTenant, switchTenantDB, protect, async (req, res) => {
  try {
    const { modules, structure, preferences, studentCount } = req.body;
    
    const tenant = req.tenant;
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Update tenant with student limit
    const updatedTenant = await Tenant.findByIdAndUpdate(
      tenant._id,
      {
        onboardingComplete: true,
        onboardingCompletedAt: new Date(),
        'settings.features.enabled': modules,
        'settings.features.disabled': [],
        'settings.studentLimit': studentCount || 50
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: 'Onboarding completed successfully',
      redirectTo: '/pricing',
      data: {
        tenant: {
          id: updatedTenant._id,
          subdomain: updatedTenant.subdomain,
          schoolName: updatedTenant.schoolName,
          onboardingComplete: updatedTenant.onboardingComplete,
          studentLimit: updatedTenant.settings.studentLimit
        }
      }
    });
  } catch (error) {
    console.error('Onboarding completion failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding'
    });
  }
});

// @desc    Get onboarding status for current tenant
// @route   GET /api/onboarding/status
// @access  Private
router.get('/status', extractTenant, switchTenantDB, protect, async (req, res) => {
  try {
    // Tenant is already available from middleware
    const tenant = req.tenant;
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Get enabled features from tenant settings
    const enabledFeatures = tenant.settings?.features?.enabled || ['students', 'teachers'];

    res.json({
      success: true,
      data: {
        onboardingComplete: tenant.onboardingComplete || false,
        tenant: {
          subdomain: tenant.subdomain,
          schoolName: tenant.schoolName,
          status: tenant.status,
          settings: {
            features: {
              enabled: enabledFeatures
            }
          }
        },
        subscription: tenant.subscription ? {
          plan: tenant.subscription.plan,
          status: tenant.subscription.status,
          features: tenant.subscription.features,
          limits: tenant.subscription.limits
        } : null
      }
    });
  } catch (error) {
    console.error('Failed to get onboarding status:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @desc    Start trial without payment
// @route   POST /api/onboarding/start-trial
// @access  Private
router.post('/start-trial', extractTenant, switchTenantDB, protect, async (req, res) => {
  try {
    const { selectedFeatures, monthlyAmount } = req.body;
    const tenant = req.tenant;
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    // Update tenant with trial information
    const updatedTenant = await Tenant.findByIdAndUpdate(
      tenant._id,
      {
        onboardingComplete: true,
        onboardingCompletedAt: new Date(),
        status: 'trial',
        'billing.selectedFeatures': selectedFeatures,
        'billing.monthlyAmount': monthlyAmount,
        'billing.trialStartedAt': new Date(),
        'billing.trialEndsAt': new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Trial started successfully! Welcome to your school management system.',
      redirectTo: '/dashboard',
      data: {
        tenant: {
          id: updatedTenant._id,
          status: updatedTenant.status,
          trialEndsAt: updatedTenant.billing.trialEndsAt
        }
      }
    });
  } catch (error) {
    console.error('Trial start failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start trial'
    });
  }
});

module.exports = router;