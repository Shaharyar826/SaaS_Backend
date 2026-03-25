/**
 * app-worker.js — Express app export WITHOUT starting a server.
 * Used by the Cloudflare Worker entry point.
 * server.js calls app.listen(); this file exports the same app without that call.
 *
 * Keep this file in sync with server.js — only difference is no app.listen().
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(compression());

// Rate limiting — Workers have their own per-IP limits but keep this as a safety net
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// ── CORS ────────────────────────────────────────────────────────────────────
const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    const allowed = (process.env.ALLOWED_ORIGINS || 'https://saas-learnify.pages.dev')
      .split(',').map(o => o.trim()).filter(Boolean);
    if (allowed.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'X-Tenant'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── Webhook route BEFORE express.json() (needs raw body) ────────────────────
const webhookRoutes = require('./routes/webhook.routes');
app.use('/api/webhooks', webhookRoutes);

// ── Standard middleware ──────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Disable node-cron in Workers (handled by wrangler [triggers] + /api/jobs/* endpoints)
process.env.DISABLE_CRON = 'true';

// ── Routes (identical to server.js) ─────────────────────────────────────────
const { extractTenant, switchTenantDB } = require('./middleware/tenant');
const authRoutes           = require('./routes/auth.routes');
const userRoutes           = require('./routes/user.routes');
const teacherRoutes        = require('./routes/teacher.routes');
const studentRoutes        = require('./routes/student.routes');
const supportStaffRoutes   = require('./routes/supportStaff.routes');
const adminStaffRoutes     = require('./routes/adminStaff.routes');
const attendanceRoutes     = require('./routes/attendance.routes');
const feeRoutes            = require('./routes/fee.routes');
const feeReceiptRoutes     = require('./routes/fee-receipt.routes');
const salaryRoutes         = require('./routes/salary.routes');
const noticeRoutes         = require('./routes/notice.routes');
const dashboardRoutes      = require('./routes/dashboard.routes');
const filterRoutes         = require('./routes/filter.routes');
const systemRoutes         = require('./routes/system.routes');
const uploadRoutes         = require('./routes/upload.routes');
const profileImageRoutes   = require('./routes/profileImage.routes');
const passwordResetRoutes  = require('./routes/passwordReset.routes');
const meetingRoutes        = require('./routes/meeting.routes');
const notificationRoutes   = require('./routes/notification.routes');
const historyRoutes        = require('./routes/history.routes');
const publicRoutes         = require('./routes/public.routes');
const schoolSettingsRoutes = require('./routes/schoolSettings.routes');
const landingPageRoutes    = require('./routes/landingPage.routes');
const contactRoutes        = require('./routes/contact.routes');
const pageContentRoutes    = require('./routes/pageContent.routes');
const galleryRoutes        = require('./routes/gallery.routes');
const eventsPageContentRoutes = require('./routes/eventsPageContent.routes');
const absenceFineRoutes    = require('./routes/absence-fine.routes');
const onboardingRoutes     = require('./routes/onboarding.routes');
const subscriptionRoutes   = require('./routes/subscription.routes');
const superAdminRoutes     = require('./routes/superAdmin.routes');
const stripeRoutes         = require('./routes/stripe.routes');
const billingRoutes        = require('./routes/billing.routes');
const parentRoutes         = require('./routes/parent.routes');
const resultRoutes         = require('./routes/result.routes');
const r2UploadRoutes        = require('./routes/r2Upload.routes');
const tenantAdminRoutes    = require('./routes/tenantAdmin.routes');
const jobsRoutes           = require('./routes/jobs.routes');

app.use('/api/auth', (req, res, next) => {
  if (req.path === '/me' || req.path === '/updatedetails' || req.path === '/updatepassword') {
    extractTenant(req, res, (err) => {
      if (err) {
        if (req.path === '/me') return res.status(401).json({ success: false, message: 'Not authenticated' });
        return next(err);
      }
      switchTenantDB(req, res, next);
    });
  } else {
    next();
  }
}, authRoutes);

app.use('/api/onboarding',  onboardingRoutes);
app.use('/api/public',      publicRoutes);
app.use('/api/billing',     billingRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/jobs',        jobsRoutes); // Cron trigger endpoints — guarded by CRON_SECRET

app.use('/api', extractTenant);
app.use('/api', switchTenantDB);

app.use('/api/users',              userRoutes);
app.use('/api/teachers',           teacherRoutes);
app.use('/api/students',           studentRoutes);
app.use('/api/support-staff',      supportStaffRoutes);
app.use('/api/admin-staff',        adminStaffRoutes);
app.use('/api/attendance',         attendanceRoutes);
app.use('/api/fees',               feeRoutes);
app.use('/api/fee-receipts',       feeReceiptRoutes);
app.use('/api/salaries',           salaryRoutes);
app.use('/api/events-notices',     noticeRoutes);
app.use('/api/dashboard',          dashboardRoutes);
app.use('/api/filters',            filterRoutes);
app.use('/api/system',             systemRoutes);
app.use('/api/upload',             uploadRoutes);
app.use('/api/profile-image',      profileImageRoutes);
app.use('/api/password-reset',     passwordResetRoutes);
app.use('/api/meetings',           meetingRoutes);
app.use('/api/notifications',      notificationRoutes);
app.use('/api/history',            historyRoutes);
app.use('/api/school-settings',    schoolSettingsRoutes);
app.use('/api/landing-page',       landingPageRoutes);
app.use('/api/contact',            contactRoutes);
app.use('/api/page-content',       pageContentRoutes);
app.use('/api/gallery',            galleryRoutes);
app.use('/api/events-page-content',eventsPageContentRoutes);
app.use('/api/absence-fine',       absenceFineRoutes);
app.use('/api/subscription',       subscriptionRoutes);
app.use('/api/stripe',             stripeRoutes);
app.use('/api/parent',             parentRoutes);
app.use('/api/results',            resultRoutes);
app.use('/api/tenant-admin',       tenantAdminRoutes);
app.use('/api/r2',                 r2UploadRoutes);

// ── Error handler ────────────────────────────────────────────────────────────
const errorHandler = require('./middleware/error');
app.use(errorHandler);

// ── MongoDB connection (lazy singleton — safe for Worker cold starts) ────────
let dbConnected = false;
async function ensureDB() {
  if (dbConnected) return;
  await mongoose.connect(process.env.MONGODB_URI, {
    maxPoolSize: 5,   // lower than server.js — Workers are ephemeral
    minPoolSize: 1,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  });
  dbConnected = true;
}

// Wrap app.handle so DB is ready before any request is processed
const originalHandle = app.handle.bind(app);
app.handle = async (req, res, next) => {
  try {
    await ensureDB();
  } catch (err) {
    return res.status(503).json({ success: false, message: 'Database unavailable' });
  }
  originalHandle(req, res, next);
};

export default app;
