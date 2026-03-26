const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

// Environment variables loaded
console.log('Starting server...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT || 5000);

// Initialize Express app
const app = express();

// Trust Render's proxy (required for rate limiting and IP detection)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet()); // Set security headers
app.use(compression()); // Compress responses

// Rate limiting - more lenient in development
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Much higher limit in development
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for localhost in development
    if (process.env.NODE_ENV !== 'production' &&
        (req.ip === '127.0.0.1' || req.ip === '::1' || req.ip.includes('localhost'))) {
      return true;
    }
    return false;
  }
});

// Health check — before rate limiter so UptimeRobot can always reach it
app.get('/api/health', (req, res) => {
  res.json({ ok: true, dbConnected: mongoose.connection.readyState === 1 });
});

// Apply rate limiting to all API routes
app.use('/api', apiLimiter);

// CORS configuration
// Production: set ALLOWED_ORIGINS=https://app.yourdomain.com in .env (comma-separated for multiple)
// Development: falls back to localhost:5173
const ALLOWED_ORIGINS = process.env.NODE_ENV === 'production'
  ? (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:5174'];

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true); // mobile apps / curl
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Dev-only tunnel support via env var (never in production)
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_TUNNEL_ORIGIN === origin) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 'Authorization', 'X-Requested-With',
    'Accept', 'Origin', 'Cache-Control', 'X-Tenant',
  ],
}));

// Webhook route MUST be registered before express.json() to receive raw body
const webhookRoutes = require('./routes/webhook.routes');
app.use('/api/webhooks', webhookRoutes);

// Standard middleware
app.use(express.json({ limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static('public'));

// Note: Local uploads directory creation removed - using Cloudinary for all image storage

// Import routes
const { extractTenant, switchTenantDB } = require('./middleware/tenant');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const teacherRoutes = require('./routes/teacher.routes');
const studentRoutes = require('./routes/student.routes');
const supportStaffRoutes = require('./routes/supportStaff.routes');
const adminStaffRoutes = require('./routes/adminStaff.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const feeRoutes = require('./routes/fee.routes');
const feeReceiptRoutes = require('./routes/fee-receipt.routes');
const salaryRoutes = require('./routes/salary.routes');
const noticeRoutes = require('./routes/notice.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const filterRoutes = require('./routes/filter.routes');
const systemRoutes = require('./routes/system.routes');
const uploadRoutes = require('./routes/upload.routes');
const profileImageRoutes = require('./routes/profileImage.routes');
const passwordResetRoutes = require('./routes/passwordReset.routes');
const meetingRoutes = require('./routes/meeting.routes');
const notificationRoutes = require('./routes/notification.routes');
const historyRoutes = require('./routes/history.routes');
const publicRoutes = require('./routes/public.routes');
const schoolSettingsRoutes = require('./routes/schoolSettings.routes');
const landingPageRoutes = require('./routes/landingPage.routes');
const contactRoutes = require('./routes/contact.routes');
const pageContentRoutes = require('./routes/pageContent.routes');
const galleryRoutes = require('./routes/gallery.routes');
const eventsPageContentRoutes = require('./routes/eventsPageContent.routes');
const absenceFineRoutes = require('./routes/absence-fine.routes');
const onboardingRoutes = require('./routes/onboarding.routes');
const subscriptionRoutes = require('./routes/subscription.routes');
const superAdminRoutes = require('./routes/superAdmin.routes');
const stripeRoutes = require('./routes/stripe.routes');
const billingRoutes = require('./routes/billing.routes');
const parentRoutes = require('./routes/parent.routes');
const resultRoutes = require('./routes/result.routes');
const tenantAdminRoutes = require('./routes/tenantAdmin.routes');

// Define API routes - Move auth routes before middleware
app.use('/api/auth', (req, res, next) => {
  // Apply tenant middleware to endpoints that need tenant context
  if (req.path === '/me' || req.path === '/updatedetails' || req.path === '/updatepassword') {
    extractTenant(req, res, (err) => {
      if (err) {
        // For /me endpoint, if no tenant context, just return not authenticated
        if (req.path === '/me') {
          return res.status(401).json({
            success: false,
            message: 'Not authenticated'
          });
        }
        return next(err);
      }
      switchTenantDB(req, res, next);
    });
  } else {
    next();
  }
}, authRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/super-admin', superAdminRoutes);

// Apply tenant middleware to remaining API routes
app.use('/api', (req, res, next) => {
  extractTenant(req, res, next);
});

app.use('/api', (req, res, next) => {
  switchTenantDB(req, res, next);
});

// Other API routes
app.use('/api/users', userRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/support-staff', supportStaffRoutes);
app.use('/api/admin-staff', adminStaffRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/fee-receipts', feeReceiptRoutes);
app.use('/api/salaries', salaryRoutes);
app.use('/api/events-notices', noticeRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/filters', filterRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/profile-image', profileImageRoutes);
app.use('/api/password-reset', passwordResetRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/school-settings', schoolSettingsRoutes);
app.use('/api/landing-page', landingPageRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/page-content', pageContentRoutes);
app.use('/api/gallery', galleryRoutes);
app.use('/api/events-page-content', eventsPageContentRoutes);
app.use('/api/absence-fine', absenceFineRoutes);
app.use('/api/subscription', subscriptionRoutes);
app.use('/api/stripe', stripeRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/tenant-admin', tenantAdminRoutes);

// Note: Static file serving for uploads removed - all images now served from Cloudinary

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Serve static files from the React app in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'public')));

  // Add a proper catchall route for SPA
  app.use((req, res, next) => {
    // Skip API routes
    if (req.url.startsWith('/api')) {
      return next();
    }
    // Send the React app's index.html for all other routes
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

// Error handling middleware
const errorHandler = require('./middleware/error');
app.use(errorHandler);

// MongoDB connection with retry logic
const connectDB = async (retries = 5) => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 30000,
      socketTimeoutMS: 75000,
      connectTimeoutMS: 60000,
      maxPoolSize: 10,
      minPoolSize: 2
    });
    
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.log('MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected');
    });
    
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    
    if (retries > 0) {
      console.log(`Retrying MongoDB connection... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      return connectDB(retries - 1);
    }
    
    console.error('Failed to connect to MongoDB after all retries');
    process.exit(1);
  }
};

// Import seeder
const { createDefaultAccounts } = require('./utils/seeder');

// Connect to database
connectDB().then(() => {
  console.log('Database connected, skipping seeder due to timeout issues');
}).catch((dbError) => {
  console.error('Database connection failed:', dbError);
  process.exit(1);
});

// Server setup
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('=== UNHANDLED PROMISE REJECTION ===');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('Promise:', promise);
  console.error('NODE_ENV:', process.env.NODE_ENV);
  console.error('Timestamp:', new Date().toISOString());

  // In development, don't exit the process to allow for debugging
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
    console.error('Server continuing in development mode...');
    return;
  }

  // In production, gracefully close server and exit
  console.error('Shutting down server due to unhandled promise rejection...');
  gracefulShutdown();
  server.close(() => {
    console.error('Server closed. Exiting process...');
    process.exit(1);
  });
  
  // Force exit after 10 seconds if graceful shutdown fails
  setTimeout(() => {
    console.error('Forced exit after graceful shutdown timeout');
    process.exit(1);
  }, 10000);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('=== UNCAUGHT EXCEPTION ===');
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);
  console.error('NODE_ENV:', process.env.NODE_ENV);
  console.error('Timestamp:', new Date().toISOString());

  // In development, don't exit the process
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production') {
    console.error('Server continuing in development mode...');
    return;
  }

  // In production, exit immediately for uncaught exceptions
  console.error('Shutting down server due to uncaught exception...');
  gracefulShutdown();
  process.exit(1);
});

// Graceful shutdown with connection cleanup
const gracefulShutdown = async () => {
  console.log('Closing tenant database connections...');
  const { tenantPool } = require('./middleware/tenant');
  await tenantPool.closeAllConnections();
};

process.on('SIGTERM', () => {
  console.log('=== SIGTERM RECEIVED ===');
  console.log('SIGTERM received. Shutting down gracefully...');
  gracefulShutdown().then(() => {
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('=== SIGINT RECEIVED ===');
  console.log('SIGINT received. Shutting down gracefully...');
  gracefulShutdown().then(() => {
    server.close(() => {
      console.log('Process terminated');
      process.exit(0);
    });
  });
});
