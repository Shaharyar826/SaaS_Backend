const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getStripeConfig,
  createCheckoutSession,
  createPortalSession
} = require('../controllers/stripe.controller');

// @desc    Get Stripe configuration
// @route   GET /api/stripe/config
// @access  Public
router.get('/config', getStripeConfig);

// @desc    Create checkout session
// @route   POST /api/stripe/create-checkout-session
// @access  Private
router.post('/create-checkout-session', protect, createCheckoutSession);

// @desc    Create billing portal session
// @route   POST /api/stripe/create-portal-session
// @access  Private
router.post('/create-portal-session', protect, createPortalSession);

module.exports = router;