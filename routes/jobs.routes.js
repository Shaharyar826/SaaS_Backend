const express = require('express');
const router = express.Router();
const { runMonthlyBilling, runOverdueBilling } = require('../controllers/jobs.controller');

/**
 * Cron secret guard — rejects any request that doesn't carry the shared
 * CRON_SECRET set via `wrangler secret put CRON_SECRET`.
 * This prevents public access to the billing trigger endpoints.
 */
function requireCronSecret(req, res, next) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // If CRON_SECRET is not configured, block all requests to be safe
    return res.status(503).json({ success: false, message: 'Cron jobs not configured' });
  }
  if (req.headers['x-cron-secret'] !== secret) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
}

router.post('/billing/monthly', requireCronSecret, runMonthlyBilling);
router.post('/billing/overdue', requireCronSecret, runOverdueBilling);

module.exports = router;
