const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { SECURITY_CONFIG } = require('../config/security');

const cloudinaryImageSchema = {
  url: String,
  metadata: {
    folder: String,
    format: String,
    resourceType: String,
    publicId: String,
    createdAt: Date
  }
};

const UserSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  firstName: {
    type: String,
    required: [true, 'Please add a first name'],
    trim: true,
    maxlength: [30, 'First name cannot be more than 30 characters']
  },
  middleName: {
    type: String,
    trim: true,
    maxlength: [30, 'Middle name cannot be more than 30 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Please add a last name'],
    trim: true,
    maxlength: [30, 'Last name cannot be more than 30 characters']
  },
  name: {
    type: String,
    trim: true,
    maxlength: [50, 'Name cannot be more than 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  nationality: {
    type: String,
    trim: true,
    maxlength: [50, 'Nationality cannot be more than 50 characters']
  },
  phone: {
    countryCode: {
      type: String,
      trim: true
    },
    number: {
      type: String,
      trim: true
    },
    full: {
      type: String,
      trim: true
    }
  },
  password: {
    type: String,
    required: function() {
      return !this.oauth.googleId; // Password not required for OAuth users
    },
    minlength: [8, 'Password must be at least 8 characters'],
    select: false
  },
  passwordHistory: [{
    hash: String,
    createdAt: { type: Date, default: Date.now }
  }],
  passwordChangedAt: Date,
  role: {
    type: String,
    enum: ['admin', 'principal', 'vice-principal', 'teacher', 'student', 'accountant', 'parent', 'tenant_system_admin'],
    default: 'student'
  },
  status: {
    type: String,
    enum: ['active', 'on hold', 'inactive', 'pending_verification'],
    default: 'on hold'
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  profileImage: cloudinaryImageSchema,
  // Email verification
  emailVerification: {
    isVerified: { type: Boolean, default: false },
    verificationToken: String,
    verificationExpires: Date,
    verifiedAt: Date,
    resendCount: { type: Number, default: 0 },
    lastResendAt: Date
  },
  // OAuth integration
  oauth: {
    googleId: String,
    provider: String,
    providerId: String,
    verifiedEmail: Boolean
  },
  // Authentication tracking
  auth: {
    lastLogin: Date,
    lastLoginIP: String,
    lastLoginUserAgent: String,
    loginCount: { type: Number, default: 0 },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: Date,
    lockoutCount: { type: Number, default: 0 },
    suspiciousActivity: [{
      type: String,
      timestamp: Date,
      details: String,
      ipAddress: String
    }]
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  isSystemAccount: {
    type: Boolean,
    default: false
  },
  passwordResetRequired: {
    type: Boolean,
    default: false
  },
  resetPasswordToken: String,
  resetPasswordExpire: Date
});

// Generate full name from first, middle, and last name
UserSchema.pre('save', function(next) {
  // Always ensure name is set correctly, even if firstName/lastName haven't been modified
  // This ensures bulk uploads and other creation methods always have a proper name field
  let fullName = this.firstName || '';

  if (this.middleName && this.middleName.trim() !== '') {
    fullName += ' ' + this.middleName;
  }

  if (this.lastName) {
    fullName += ' ' + this.lastName;
  }

  // Trim any extra spaces and set the name
  this.name = fullName.trim();

  next();
});

// Encrypt password using bcrypt with enhanced security
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }

  // Check password history to prevent reuse
  if (this.passwordHistory && this.passwordHistory.length > 0) {
    for (const oldPassword of this.passwordHistory) {
      const isReused = await bcrypt.compare(this.password, oldPassword.hash);
      if (isReused) {
        const error = new Error('Cannot reuse recent passwords');
        error.name = 'ValidationError';
        return next(error);
      }
    }
  }

  // Store current password in history before hashing new one
  if (this.isModified('password') && !this.isNew) {
    const currentPasswordHash = this.password;
    if (!this.passwordHistory) this.passwordHistory = [];
    
    this.passwordHistory.unshift({
      hash: currentPasswordHash,
      createdAt: new Date()
    });
    
    // Keep only last N passwords
    if (this.passwordHistory.length > SECURITY_CONFIG.password.historyCount) {
      this.passwordHistory = this.passwordHistory.slice(0, SECURITY_CONFIG.password.historyCount);
    }
  }

  // Hash new password with higher cost factor
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  this.passwordChangedAt = new Date();
});

// Delete Cloudinary profile image before removing user
UserSchema.pre('remove', async function(next) {
  try {
    if (this.profileImage?.metadata?.publicId) {
      const cloudinary = require('../config/cloudinary');
      await cloudinary.uploader.destroy(this.profileImage.metadata.publicId);
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Sign JWT and return - DEPRECATED: Use TokenManager instead
UserSchema.methods.getSignedJwtToken = function() {
  console.log('WARNING: Using deprecated getSignedJwtToken method');
  return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if password needs to be changed
UserSchema.methods.isPasswordExpired = function() {
  if (!this.passwordChangedAt) return false;
  const expiryDate = new Date(this.passwordChangedAt.getTime() + SECURITY_CONFIG.password.maxAge);
  return new Date() > expiryDate;
};

// Static method to reset a user's password
UserSchema.statics.resetPassword = async function(userId, newPassword) {
  try {
    // Find the user
    const user = await this.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update the password directly in the database to bypass pre-save hooks
    // Also set the passwordResetRequired flag to true
    await this.findByIdAndUpdate(userId, {
      password: hashedPassword,
      passwordResetRequired: true
    });

    return { success: true, message: 'Password reset successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Generate email verification token
UserSchema.methods.generateEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(20).toString('hex');
  this.emailVerification.verificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  this.emailVerification.verificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return verificationToken;
};

// Verify email
UserSchema.methods.verifyEmail = function() {
  this.emailVerification.isVerified = true;
  this.emailVerification.verifiedAt = new Date();
  this.emailVerification.verificationToken = undefined;
  this.emailVerification.verificationExpires = undefined;
};

// Check if account is locked
UserSchema.methods.isLocked = function() {
  return !!(this.auth.lockedUntil && this.auth.lockedUntil > Date.now());
};

// Get remaining lockout time in minutes
UserSchema.methods.getLockoutTimeRemaining = function() {
  if (!this.isLocked()) return 0;
  return Math.ceil((this.auth.lockedUntil - Date.now()) / (1000 * 60));
};

// Increment failed login attempts with progressive lockout
UserSchema.methods.incLoginAttempts = function(ipAddress = null, userAgent = null) {
  // Clear expired lockout
  if (this.auth.lockedUntil && this.auth.lockedUntil < Date.now()) {
    return this.updateOne({
      $unset: { 'auth.lockedUntil': 1, 'auth.failedLoginAttempts': 1 }
    });
  }
  
  const updates = { $inc: { 'auth.failedLoginAttempts': 1 } };
  
  // Log suspicious activity
  if (ipAddress) {
    updates.$push = {
      'auth.suspiciousActivity': {
        $each: [{
          type: 'failed_login',
          timestamp: new Date(),
          details: `Failed login attempt ${this.auth.failedLoginAttempts + 1}`,
          ipAddress
        }],
        $slice: -10 // Keep only last 10 activities
      }
    };
  }
  
  // Progressive lockout based on attempt count and history
  const attemptCount = this.auth.failedLoginAttempts + 1;
  const lockoutCount = this.auth.lockoutCount || 0;
  
  if (attemptCount >= SECURITY_CONFIG.lockout.maxAttempts && !this.isLocked()) {
    // Progressive lockout duration
    let lockoutDuration = SECURITY_CONFIG.lockout.lockoutDuration;
    if (lockoutCount > 0) {
      lockoutDuration *= Math.pow(2, Math.min(lockoutCount, 5)); // Max 32x multiplier
    }
    
    updates.$set = { 
      'auth.lockedUntil': Date.now() + lockoutDuration,
      'auth.lockoutCount': lockoutCount + 1
    };
  }
  
  return this.updateOne(updates);
};

// Reset login attempts on successful login
UserSchema.methods.resetLoginAttempts = function(ipAddress = null, userAgent = null) {
  const updates = {
    $unset: { 'auth.failedLoginAttempts': 1, 'auth.lockedUntil': 1 },
    $set: { 
      'auth.lastLogin': new Date(),
      'auth.lastLoginIP': ipAddress,
      'auth.lastLoginUserAgent': userAgent
    },
    $inc: { 'auth.loginCount': 1 }
  };
  
  return this.updateOne(updates);
};

// Record suspicious activity
UserSchema.methods.recordSuspiciousActivity = function(type, details, ipAddress) {
  return this.updateOne({
    $push: {
      'auth.suspiciousActivity': {
        $each: [{
          type,
          timestamp: new Date(),
          details,
          ipAddress
        }],
        $slice: -10
      }
    }
  });
};

// Check for suspicious login patterns
UserSchema.methods.hasSuspiciousActivity = function(ipAddress) {
  if (!this.auth.suspiciousActivity || this.auth.suspiciousActivity.length === 0) {
    return false;
  }
  
  const recentActivity = this.auth.suspiciousActivity.filter(
    activity => Date.now() - activity.timestamp.getTime() < 24 * 60 * 60 * 1000 // Last 24 hours
  );
  
  // Check for multiple failed attempts from different IPs
  const uniqueIPs = new Set(recentActivity.map(a => a.ipAddress));
  if (uniqueIPs.size > 3) return true;
  
  // Check for rapid successive attempts
  const failedAttempts = recentActivity.filter(a => a.type === 'failed_login');
  if (failedAttempts.length > 10) return true;
  
  return false;
};

// Compound indexes for efficient tenant-scoped queries
UserSchema.index({ tenant: 1, email: 1 }, { unique: true });
UserSchema.index({ tenant: 1, role: 1 });
UserSchema.index({ tenant: 1, status: 1 });
UserSchema.index({ tenant: 1, isApproved: 1 });
UserSchema.index({ tenant: 1, createdAt: -1 });

module.exports = mongoose.model('User', UserSchema);
