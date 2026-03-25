const express = require('express');
const {
  registerTenant,
  verifyEmail,
  resendVerification,
  login,
  logout,
  refreshToken,
  getMe,
  updateDetails,
  updatePassword,
  googleAuth
} = require('../controllers/auth.controller');
const Tenant = require('../models/Tenant');

const { protect, sensitiveOperation } = require('../middleware/auth');
const { authLimiters } = require('../config/security');
const multer = require('multer');
const { uploadImage } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Configure multer for handling file uploads with security
const uploadMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // Reduced to 2MB for security
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Strict image validation
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'), false);
    }
  }
});

// Public routes with rate limiting
router.get('/check-tenant/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    const tenant = await Tenant.findOne({
      $or: [
        { subdomain: identifier },
        { customDomain: identifier }
      ]
    }).select('subdomain schoolName status');

    if (!tenant) {
      return res.json({
        success: true,
        exists: false
      });
    }

    res.json({
      success: true,
      exists: true,
      data: {
        subdomain: tenant.subdomain,
        schoolName: tenant.schoolName,
        status: tenant.status
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

router.post('/register-tenant', 
  authLimiters.register,
  registerTenant
);

router.post('/verify-email', 
  authLimiters.emailVerification,
  verifyEmail
);

router.post('/resend-verification', 
  authLimiters.emailVerification,
  resendVerification
);

router.post('/login', 
  authLimiters.login,
  authLimiters.loginSlowDown,
  login
);

router.post('/google', 
  authLimiters.login,
  googleAuth
);

router.post('/refresh', refreshToken);

// Protected routes
router.get('/me', protect, getMe);

router.post('/logout', protect, logout);

router.put('/updatedetails', 
  protect, 
  sensitiveOperation,
  uploadMulter.single('profileImage'), 
  (req, res, next) => {
    if (req.file) {
      req.body.imageType = 'profile';
      next();
    } else {
      next();
    }
  }, 
  uploadImage, 
  updateDetails
);

router.put('/updatepassword', 
  protect, 
  sensitiveOperation,
  authLimiters.passwordReset,
  updatePassword
);

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 2MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Too many files. Only one file allowed.'
      });
    }
  }
  
  if (error.message.includes('Only JPEG, PNG, and WebP')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
});

module.exports = router;
