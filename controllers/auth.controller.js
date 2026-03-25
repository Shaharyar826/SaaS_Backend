const User = require('../models/User');
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const Teacher = require('../models/Teacher');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const crypto = require('crypto');
const mongoose = require('mongoose');
const { getTenantModel } = require('../middleware/tenant');
const SAAS_CONFIG = require('../config/saas');
const emailService = require('../services/emailService');
const EmailVerificationService = require('../services/emailVerificationService');
const TokenManager = require('../utils/tokenManager');
const { 
  validateRegistrationData, 
  validateLoginData, 
  validateEmail,
  validateTenantIdentifier,
  ValidationError 
} = require('../utils/validation');
const { SECURITY_CONFIG, cookieOptions } = require('../config/security');
const { OAuth2Client } = require('google-auth-library');

// @desc    Register tenant with admin user (PRODUCTION HARDENED)
// @route   POST /api/auth/register-tenant
// @access  Public
exports.registerTenant = asyncHandler(async (req, res, next) => {
  console.log('=== SECURE TENANT REGISTRATION START ===');
  
  const mainSession = await mongoose.startSession();
  let tenantConnection = null;
  
  try {
    await mainSession.startTransaction();
    
    // Validate and sanitize input
    let validatedData;
    try {
      console.log('Raw form data received:', req.body);
      validatedData = validateRegistrationData(req.body);
      console.log('Validation successful:', validatedData);
    } catch (error) {
      console.error('Validation failed:', error);
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: error.errors,
          details: error.message
        });
      }
      throw error;
    }

    const {
      subdomain,
      schoolName,
      adminEmail,
      adminPassword,
      adminFirstName,
      adminLastName,
      nationality,
      phoneNumber
    } = validatedData;

    // Check subdomain availability with case-insensitive search
    const existingTenant = await Tenant.findOne({ 
      subdomain: { $regex: new RegExp(`^${subdomain}$`, 'i') }
    });
    
    if (existingTenant) {
      return res.status(400).json({
        success: false,
        message: 'Subdomain already taken',
        code: 'SUBDOMAIN_TAKEN',
        errors: {
          subdomain: 'Subdomain already taken'
        }
      });
    }

    // Check for existing admin email across all tenants
    const existingAdmin = await User.findOne({ email: adminEmail });
    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists',
        code: 'EMAIL_EXISTS',
        errors: {
          adminEmail: 'An account with this email already exists'
        }
      });
    }

    console.log('Creating secure tenant:', { subdomain, schoolName });

    // Create tenant database name with security prefix
    const databaseName = `tenant_${subdomain}_${crypto.randomBytes(4).toString('hex')}`;

    // Create tenant in main database
    const tenant = new Tenant({
      subdomain,
      schoolName,
      databaseName,
      status: 'setup_pending',
      onboarding: {
        currentStep: 'email_verification'
      },
      billing: {
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
      },
      security: {
        createdAt: new Date(),
        createdIP: req.ip,
        lastSecurityAudit: new Date()
      }
    });

    await tenant.save({ session: mainSession });
    console.log('Secure tenant created:', tenant._id);

    // Create subscription with security tracking
    const subscription = new Subscription({
      tenant: tenant._id,
      plan: 'trial',
      status: 'trialing',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      features: ['basic_attendance', 'simple_fees', 'email_notifications', 'basic_reports'], // Use valid enum values
      limits: {
        maxStudents: 25,
        maxTeachers: 3,
        maxStorage: 100,
        maxApiCalls: 1000
      }
    });

    await subscription.save({ session: mainSession });
    tenant.subscription = subscription._id;
    await tenant.save({ session: mainSession });

    // Commit main database transaction
    await mainSession.commitTransaction();
    console.log('Main transaction committed');

    // Create secure tenant database connection
    const tenantDbUri = process.env.MONGODB_URI.replace(
      /\/[^\/]*\?/, 
      `/${databaseName}?`
    );
    
    tenantConnection = mongoose.createConnection(tenantDbUri);
    await new Promise((resolve, reject) => {
      tenantConnection.once('open', resolve);
      tenantConnection.once('error', reject);
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });

    // Create admin user in tenant database with email verification required
    const TenantUser = tenantConnection.model('User', User.schema);
    
    const adminUser = new TenantUser({
      tenant: tenant._id,
      firstName: adminFirstName,
      lastName: adminLastName,
      email: adminEmail,
      password: adminPassword,
      nationality: nationality,
      phone: phoneNumber ? {
        full: phoneNumber
      } : undefined,
      role: 'tenant_system_admin',
      status: 'pending_verification',
      isApproved: false,
      isSystemAccount: true,
      emailVerification: {
        isVerified: false
      },
      auth: {
        loginCount: 0,
        failedLoginAttempts: 0
      }
    });

    await adminUser.save();
    console.log('Admin user created (pending verification):', adminUser._id);

    // Update tenant owner
    await Tenant.findByIdAndUpdate(tenant._id, { owner: adminUser._id });

    // Send email verification
    try {
      await EmailVerificationService.sendVerificationEmail(adminUser, tenant);
      console.log('Verification email sent successfully');
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails, but log it
    }

    console.log('=== SECURE TENANT REGISTRATION SUCCESS ===');
    res.status(201).json({
      success: true,
      message: 'School registered successfully! Please check your email to verify your account.',
      redirectTo: '/verify-email', // EXPLICIT REDIRECT CONTROL
      data: {
        tenant: {
          id: tenant._id,
          subdomain: tenant.subdomain,
          schoolName: tenant.schoolName,
          status: tenant.status
        },
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          emailVerified: false
        },
        nextStep: 'email_verification',
        requiresVerification: true
      }
    });

  } catch (error) {
    console.error('=== SECURE TENANT REGISTRATION ERROR ===');
    console.error('Error:', error);
    
    if (mainSession.inTransaction()) {
      await mainSession.abortTransaction();
    }
    
    // Don't expose internal errors in production
    const message = process.env.NODE_ENV === 'production' 
      ? 'Registration failed. Please try again.' 
      : error.message;
    
    // Log the actual error for debugging
    console.error('Registration error details:', {
      message: error.message,
      errors: error.errors,
      stack: error.stack
    });
    
    res.status(500).json({
      success: false,
      message,
      errors: error.errors, // Include validation errors
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    mainSession.endSession();
    if (tenantConnection) {
      tenantConnection.close();
    }
  }
});

// @desc    Verify email address
// @route   POST /api/auth/verify-email
// @access  Public
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  const { token, tenantIdentifier } = req.body;
  
  if (!token || !tenantIdentifier) {
    return res.status(400).json({
      success: false,
      message: 'Token and tenant identifier are required'
    });
  }
  
  try {
    // Find tenant
    const tenant = await Tenant.findOne({
      $or: [
        { subdomain: tenantIdentifier },
        { customDomain: tenantIdentifier }
      ]
    });
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    // Get tenant connection
    const tenantPool = require('../utils/tenantConnectionPool');
    const tenantConnection = await tenantPool.getConnection(tenant.databaseName);
    const TenantUser = tenantConnection.model('User', User.schema);
    
    // Verify email
    const result = await EmailVerificationService.verifyEmailToken(token, TenantUser, tenant._id);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    // If this is the admin user, approve them and update tenant status
    const user = await TenantUser.findById(result.user.id);
    if (user.role === 'admin' && user.isSystemAccount) {
      user.isApproved = true;
      user.status = 'active';
      await user.save();
      
      // Update tenant onboarding step
      await Tenant.findByIdAndUpdate(tenant._id, {
        'onboarding.currentStep': 'school_setup'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      redirectTo: user.role === 'admin' ? '/setup' : '/dashboard', // EXPLICIT REDIRECT
      data: {
        user: result.user,
        nextStep: user.role === 'admin' ? 'school_setup' : 'dashboard'
      }
    });
    
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Email verification failed'
    });
  }
});

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerification = asyncHandler(async (req, res, next) => {
  const { email, tenantIdentifier } = req.body;
  
  if (!email || !tenantIdentifier) {
    return res.status(400).json({
      success: false,
      message: 'Email and tenant identifier are required'
    });
  }
  
  try {
    // Validate email
    const validatedEmail = validateEmail(email);
    
    // Find tenant
    const tenant = await Tenant.findOne({
      $or: [
        { subdomain: tenantIdentifier },
        { customDomain: tenantIdentifier }
      ]
    });
    
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }
    
    // Get tenant connection
    const tenantPool = require('../utils/tenantConnectionPool');
    const tenantConnection = await tenantPool.getConnection(tenant.databaseName);
    const TenantUser = tenantConnection.model('User', User.schema);
    
    // Resend verification
    const result = await EmailVerificationService.resendVerificationEmail(validatedEmail, TenantUser, tenant);
    
    res.status(200).json(result);
    
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    console.error('Resend verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend verification email'
    });
  }
});

// @desc    Login user with tenant context (PRODUCTION HARDENED)
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  console.log('=== SECURE LOGIN START ===');
  
  try {
    // Validate and sanitize input
    let validatedData;
    try {
      validatedData = validateLoginData(req.body);
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          message: 'Invalid input',
          errors: error.errors
        });
      }
      throw error;
    }

    const { email, password, tenantIdentifier } = validatedData;

    console.log('Looking for tenant:', tenantIdentifier);

    // Find tenant in main database
    const tenant = await Tenant.findOne({
      $or: [
        { subdomain: tenantIdentifier },
        { customDomain: tenantIdentifier }
      ]
    }).populate('subscription');

    if (!tenant) {
      console.log('Tenant not found');
      return res.status(404).json({
        success: false,
        message: 'School not found. Please check your school subdomain.',
        code: 'TENANT_NOT_FOUND'
      });
    }

    console.log('Tenant found:', tenant.subdomain);

    if (tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Account suspended. Please contact support.'
      });
    }

    // Get tenant connection from pool
    const tenantPool = require('../utils/tenantConnectionPool');
    const tenantConnection = await tenantPool.getConnection(tenant.databaseName);
    const TenantUser = tenantConnection.model('User', User.schema);
    
    // Check for user within tenant scope
    const user = await TenantUser.findOne({ 
      email, 
      tenant: tenant._id 
    }).select('+password +auth +emailVerification');

    if (!user) {
      console.log('User not found');
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    console.log('User found:', user.email);

    // Check if account is locked
    if (user.isLocked()) {
      const remainingTime = user.getLockoutTimeRemaining();
      await user.recordSuspiciousActivity('login_attempt_while_locked', 
        `Login attempt while account locked (${remainingTime} minutes remaining)`, req.ip);
      
      return res.status(423).json({
        success: false,
        message: `Account locked. Try again in ${remainingTime} minutes.`,
        lockedUntil: user.auth.lockedUntil
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
      console.log('Password mismatch');
      await user.incLoginAttempts(req.ip, req.get('User-Agent'));
      
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check email verification requirement
    if (EmailVerificationService.isVerificationRequired(user)) {
      console.log('Email verification required for user:', user.email, 'isVerified:', user.emailVerification?.isVerified);
      return res.status(403).json({
        success: false,
        message: 'Please verify your email address before logging in',
        requiresVerification: true,
        email: user.email
      });
    }

    // Check if account is approved
    if (!user.isApproved && !user.isSystemAccount) {
      console.log('Account not approved for user:', user.email, 'isApproved:', user.isApproved, 'isSystemAccount:', user.isSystemAccount);
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval'
      });
    }

    // Check if account is active
    if (user.status === 'inactive') {
      console.log('Account inactive for user:', user.email, 'status:', user.status);
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated'
      });
    }

    // Check for suspicious activity
    if (user.hasSuspiciousActivity(req.ip)) {
      await user.recordSuspiciousActivity('suspicious_login', 
        'Login from potentially compromised account', req.ip);
      
      // Could implement additional verification here
      console.log('Suspicious activity detected for user:', user.email);
    }

    // Check password expiration
    if (user.isPasswordExpired()) {
      return res.status(403).json({
        success: false,
        message: 'Your password has expired. Please reset your password.',
        requiresPasswordReset: true
      });
    }

    // Reset failed login attempts on successful login
    await user.resetLoginAttempts(req.ip, req.get('User-Agent'));

    // Determine redirect based on onboarding and billing status
    let redirectTo = '/dashboard';
    
    if (user.role === 'tenant_system_admin' || user.role === 'admin' || user.role === 'principal') {
      const isOnboardingComplete = tenant.onboarding?.onboardingComplete === true;
      console.log('Admin login redirect logic:');
      console.log('- User role:', user.role);
      console.log('- Onboarding complete:', isOnboardingComplete);
      console.log('- Tenant status:', tenant.status);
      
      if (!isOnboardingComplete) {
        redirectTo = '/setup';
        console.log('- Redirecting to setup because onboarding not complete');
      } else if (tenant.status === 'setup_pending') {
        redirectTo = '/pricing';
        console.log('- Redirecting to pricing because setup pending');
      } else {
        const hasActiveSubscription = tenant.billing?.hasActiveSubscription === true;
        const isTrialActive = tenant.billing?.trialEndsAt && new Date(tenant.billing.trialEndsAt) > new Date();
        
        if (!hasActiveSubscription && !isTrialActive && tenant.status !== 'trial') {
          redirectTo = '/pricing';
          console.log('- Redirecting to pricing because no active subscription or trial');
        }
      }
    }

    console.log('Final redirectTo:', redirectTo);

    console.log('Login successful, redirectTo:', redirectTo);
    console.log('=== SECURE LOGIN SUCCESS ===');

    // Send enhanced token response with secure tokens
    await sendSecureTokenResponse(user, tenant, 200, res, { redirectTo }, req);

  } catch (error) {
    console.error('=== SECURE LOGIN ERROR ===');
    console.error('Error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Login failed. Please try again.'
    });
  }
});

// @desc    Google OAuth login (PRODUCTION HARDENED)
// @route   POST /api/auth/google
// @access  Public
exports.googleAuth = asyncHandler(async (req, res, next) => {
  console.log('=== SECURE GOOGLE AUTH START ===');
  const { credential, tenantIdentifier } = req.body;

  if (!credential || !tenantIdentifier) {
    return res.status(400).json({
      success: false,
      message: 'Google credential and tenant identifier required'
    });
  }

  try {
    // Validate tenant identifier
    const validatedTenant = validateTenantIdentifier(tenantIdentifier);
    
    // Verify Google JWT token with proper client ID validation
    if (!process.env.GOOGLE_CLIENT_ID) {
      throw new Error('Google OAuth not configured');
    }
    
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const googleUser = ticket.getPayload();
    console.log('Google user verified:', googleUser.email);

    if (!googleUser.email || !googleUser.email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Google account email not verified'
      });
    }

    // Validate email domain if configured
    if (process.env.ALLOWED_EMAIL_DOMAINS) {
      const allowedDomains = process.env.ALLOWED_EMAIL_DOMAINS.split(',');
      const emailDomain = googleUser.email.split('@')[1];
      if (!allowedDomains.includes(emailDomain)) {
        return res.status(403).json({
          success: false,
          message: 'Email domain not allowed'
        });
      }
    }

    // Find tenant
    const tenant = await Tenant.findOne({
      $or: [
        { subdomain: validatedTenant },
        { customDomain: validatedTenant }
      ]
    }).populate('subscription');

    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'School not found. Please check your school subdomain.',
        code: 'TENANT_NOT_FOUND'
      });
    }

    if (tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'School account suspended. Please contact support.',
        code: 'TENANT_SUSPENDED'
      });
    }

    // Get tenant connection
    const tenantPool = require('../utils/tenantConnectionPool');
    const tenantConnection = await tenantPool.getConnection(tenant.databaseName);
    const TenantUser = tenantConnection.model('User', User.schema);

    // Find existing user
    let user = await TenantUser.findOne({ 
      email: googleUser.email, 
      tenant: tenant._id 
    }).select('+auth +emailVerification');

    // User doesn't exist - return error with signup suggestion
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email. Please sign up first.',
        code: 'USER_NOT_FOUND',
        suggestion: 'Create an account using the sign-up form',
        email: googleUser.email
      });
    }

    // Check email verification
    if (!user.emailVerification?.isVerified) {
      const now = new Date();
      const tokenExpired = !user.emailVerification.verificationExpires || 
                          user.emailVerification.verificationExpires < now;
      
      if (tokenExpired) {
        // Resend verification email
        const verificationToken = user.generateEmailVerificationToken();
        await user.save();
        
        try {
          await EmailVerificationService.sendVerificationEmail(user, tenant);
        } catch (emailError) {
          console.error('Failed to resend verification email:', emailError);
        }
      }
      
      return res.status(403).json({
        success: false,
        message: 'Email verification required. A new verification email has been sent.',
        code: 'EMAIL_NOT_VERIFIED',
        requiresVerification: true,
        email: user.email,
        redirectTo: '/verify-email'
      });
    }

    // Check if account is locked
    if (user.isLocked()) {
      const remainingTime = user.getLockoutTimeRemaining();
      return res.status(423).json({
        success: false,
        message: `Account temporarily locked due to multiple failed login attempts. Try again in ${remainingTime} minutes.`,
        code: 'ACCOUNT_LOCKED',
        lockedUntil: user.auth.lockedUntil,
        remainingMinutes: remainingTime
      });
    }

    // Check if account is inactive
    if (user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact school administration.',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Check if account is on hold
    if (user.status === 'on hold') {
      return res.status(403).json({
        success: false,
        message: 'Your account is on hold. Please contact school administration.',
        code: 'ACCOUNT_ON_HOLD'
      });
    }

    // Check if account is approved
    if (!user.isApproved && !user.isSystemAccount) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending approval from school administration.',
        code: 'ACCOUNT_PENDING_APPROVAL',
        requiresApproval: true
      });
    }

    // Update OAuth info if not set
    if (!user.oauth?.googleId) {
      user.oauth = {
        googleId: googleUser.sub,
        provider: 'google',
        providerId: googleUser.sub,
        verifiedEmail: googleUser.email_verified
      };
      await user.save();
    }

    // Reset failed login attempts and update login info
    await user.resetLoginAttempts(req.ip, req.get('User-Agent'));

    // Determine redirect based on onboarding status
    let redirectTo = '/dashboard';
    if (user.role === 'tenant_system_admin' || user.role === 'admin' || user.role === 'principal') {
      const isOnboardingComplete = tenant.onboarding?.onboardingComplete === true;
      if (!isOnboardingComplete) {
        redirectTo = '/setup';
      } else if (tenant.status === 'setup_pending') {
        redirectTo = '/pricing';
      } else {
        const hasActiveSubscription = tenant.billing?.hasActiveSubscription === true;
        const isTrialActive = tenant.billing?.trialEndsAt && new Date(tenant.billing.trialEndsAt) > new Date();
        
        if (!hasActiveSubscription && !isTrialActive && tenant.status !== 'trial') {
          redirectTo = '/pricing';
        }
      }
    }

    console.log('Google auth successful, redirectTo:', redirectTo);
    await sendSecureTokenResponse(user, tenant, 200, res, { redirectTo }, req);

  } catch (error) {
    console.error('Google auth error:', error);
    
    // Handle specific Google OAuth errors
    if (error.message.includes('Token')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token. Please try again.',
        code: 'INVALID_TOKEN'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Google authentication failed. Please try again.',
      code: 'AUTH_FAILED'
    });
  }
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const TenantUser = getTenantModel(req, 'User', User.schema);
  const user = await TenantUser.findOne({ _id: req.user.id, tenant: req.tenantId });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found'
    });
  }

  // Check if user is approved and active
  if (!user.isApproved && !user.isSystemAccount) {
    return res.status(403).json({
      success: false,
      message: 'Your account is pending approval. Please contact an administrator.'
    });
  }

  if (user.status === 'inactive') {
    return res.status(403).json({
      success: false,
      message: 'Your account is inactive. Please contact an administrator.'
    });
  }

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Logout user (PRODUCTION HARDENED)
// @route   POST /api/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) await TokenManager.revokeToken(token);

    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) await TokenManager.revokeRefreshToken(refreshToken);

    const secureCookieOptions = {
      ...cookieOptions,
      expires: new Date(Date.now() + 10 * 1000)
    };

    res.clearCookie('token', secureCookieOptions);
    res.clearCookie('refreshToken', secureCookieOptions);
    res.clearCookie('accessToken', secureCookieOptions);

    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

// @desc    Refresh access token (with rotation — old refresh token is revoked)
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = asyncHandler(async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    // Verify token against MongoDB (checks signature + not revoked)
    const decoded = await TokenManager.verifyRefreshToken(refreshToken);

    // Get user from database
    const TenantUser = getTenantModel(req, 'User', User.schema);
    const user = await TenantUser.findOne({
      _id: decoded.userId,
      tenant: req.tenantId
    });

    if (!user) {
      await TokenManager.revokeRefreshToken(refreshToken);
      return res.status(401).json({ success: false, message: 'User not found' });
    }

    if (user.status !== 'active' || !user.isApproved) {
      await TokenManager.revokeAllUserTokens(user._id.toString());
      return res.status(403).json({ success: false, message: 'Account no longer active' });
    }

    // Rotate: revoke old refresh token, issue new pair
    const userPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
      tenant: user.tenant
    };
    const { accessToken, refreshToken: newRefreshToken } = await TokenManager.rotateRefreshToken(
      refreshToken,
      userPayload
    );

    // Set new cookies
    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', newRefreshToken, cookieOptions);

    res.status(200).json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: '15m'
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ success: false, message: 'Invalid refresh token' });
  }
});

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = asyncHandler(async (req, res, next) => {
  const fieldsToUpdate = {
    firstName: req.body.firstName,
    middleName: req.body.middleName,
    lastName: req.body.lastName,
    email: req.body.email
  };

  // If there's a new image uploaded via Cloudinary
  if (req.cloudinaryUrl) {
    fieldsToUpdate.profileImage = {
      url: req.cloudinaryUrl,
      metadata: {
        ...req.cloudinaryMetadata,
        publicId: req.cloudinaryPublicId
      }
    };
  }

  const TenantUser = getTenantModel(req, 'User', User.schema);
  const user = await TenantUser.findOneAndUpdate(
    { _id: req.user.id, tenant: req.tenantId },
    fieldsToUpdate,
    {
      new: true,
      runValidators: true
    }
  );

  res.status(200).json({
    success: true,
    data: user
  });
});

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const TenantUser = getTenantModel(req, 'User', User.schema);
  const user = await TenantUser.findOne({ _id: req.user.id, tenant: req.tenantId }).select('+password');

  // Check current password
  if (!(await user.matchPassword(req.body.currentPassword))) {
    return next(new ErrorResponse('Password is incorrect', 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res);
});

// Enhanced secure token response with refresh tokens (async — TokenManager now uses MongoDB)
const sendSecureTokenResponse = async (user, tenant, statusCode, res, additionalData = {}, req = null) => {
  const userPayload = {
    id: user._id,
    email: user.email,
    role: user.role,
    tenant: user.tenant
  };

  const { accessToken, refreshToken } = await TokenManager.generateTokenPair(userPayload);

  // Set secure cookies
  res.cookie('accessToken', accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000 // 15 minutes
  });

  res.cookie('refreshToken', refreshToken, cookieOptions);

  if (req) {
    console.log(`Secure login: ${user.email} from ${req.ip} at ${new Date().toISOString()}`);
  }

  res.status(statusCode).json({
    success: true,
    accessToken,
    refreshToken,
    expiresIn: '15m',
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      emailVerified: user.emailVerification?.isVerified || false,
      tenant: {
        id: tenant._id,
        subdomain: tenant.subdomain,
        schoolName: tenant.schoolName,
        onboardingComplete: tenant.onboarding?.onboardingComplete || false,
        requiresPayment: !tenant.billing?.hasActiveSubscription
      },
      ...additionalData
    }
  });
};

// Get token from model, create cookie and send response - DEPRECATED
const sendTokenResponse = (user, statusCode, res) => {
  console.log('WARNING: Using deprecated sendTokenResponse method');
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token
    });
};