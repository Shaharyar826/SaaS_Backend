const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { protectSuperAdmin } = require('../middleware/superAdminAuth');
const {
  generateMonthlyBills,
  getTenantBilling,
  getCurrentBill,
  getPricing,
  calculateEstimate,
  markBillPaid,
  getOverdueBills
} = require('../controllers/billing.controller');

// Public routes
router.get('/pricing', getPricing);
router.post('/estimate', calculateEstimate);

// Protected routes
router.get('/current', protect, getCurrentBill);
router.get('/tenant/:tenantId', protect, getTenantBilling);

// Super Admin routes
router.post('/generate', protectSuperAdmin, generateMonthlyBills);
router.put('/:id/paid', protectSuperAdmin, markBillPaid);
router.get('/overdue', protectSuperAdmin, getOverdueBills);

module.exports = router;