/**
 * jobs.controller.js
 *
 * Protected endpoints called by Cloudflare Cron Triggers via HTTP POST.
 * Guarded by CRON_SECRET header — never exposed to the public internet.
 *
 * The Worker's scheduled() handler calls:
 *   POST /api/jobs/billing/monthly
 *   POST /api/jobs/billing/overdue
 */

const asyncHandler = require('../middleware/async');
const BillingService = require('../services/billingService');

// @desc    Generate monthly bills for all active tenants
// @route   POST /api/jobs/billing/monthly
// @access  Cron (X-Cron-Secret header)
exports.runMonthlyBilling = asyncHandler(async (req, res) => {
  console.log('[CRON] Starting monthly billing job...');
  const results = await BillingService.generateMonthlyBills();
  console.log('[CRON] Monthly billing complete:', results);
  res.json({ success: true, results });
});

// @desc    Mark overdue bills
// @route   POST /api/jobs/billing/overdue
// @access  Cron (X-Cron-Secret header)
exports.runOverdueBilling = asyncHandler(async (req, res) => {
  console.log('[CRON] Starting overdue billing update...');
  const result = await BillingService.updateOverdueBills();
  console.log('[CRON] Overdue billing complete:', result);
  res.json({ success: true, modifiedCount: result.modifiedCount });
});
