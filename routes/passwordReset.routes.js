const express = require('express');
const {
  requestPasswordReset,
  getPasswordResetRequests,
  approvePasswordReset,
  rejectPasswordReset
} = require('../controllers/passwordReset.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public route for requesting password reset
router.post('/request', requestPasswordReset);

// Admin/Principal only routes
router.get(
  '/requests',
  protect,
  authorize('admin', 'principal'),
  getPasswordResetRequests
);

router.put(
  '/approve/:id',
  protect,
  authorize('admin', 'principal'),
  approvePasswordReset
);

router.put(
  '/reject/:id',
  protect,
  authorize('admin', 'principal'),
  rejectPasswordReset
);

module.exports = router;
