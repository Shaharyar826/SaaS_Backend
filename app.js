const express = require('express');
const app = express();
const uploadRoutes = require('./routes/upload.routes');
const eventsPageContentRoutes = require('./routes/eventsPageContent.routes');
const billingRoutes = require('./routes/billing.routes');
const { scheduleMonthlyBilling, scheduleOverdueUpdates } = require('./jobs/billingJobs');

// Mount routes
app.use('/api/upload', uploadRoutes);
app.use('/api/events-page-content', eventsPageContentRoutes);
app.use('/api/billing', billingRoutes);

// Start billing cron jobs only when running as a plain Node.js server.
// On Cloudflare Workers, cron is handled by wrangler.toml [triggers] + /api/jobs/* endpoints.
if (process.env.DISABLE_CRON !== 'true') {
  scheduleMonthlyBilling();
  scheduleOverdueUpdates();
}

// ... existing code ... 