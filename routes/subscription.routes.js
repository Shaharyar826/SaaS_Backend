const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  getPlans,
  getSubscription,
  createCheckoutSession,
  createPortalSession
} = require('../controllers/stripe.controller');

// Public
router.get('/plans', getPlans);

// Protected — any authenticated user can view subscription
router.get('/', protect, getSubscription);

// Admin/Principal only
router.post('/create-checkout-session', protect, authorize('admin', 'principal'), createCheckoutSession);
router.post('/create-portal-session', protect, authorize('admin', 'principal'), createPortalSession);

module.exports = router;
