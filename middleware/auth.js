const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getTenantModel } = require('./tenant');
const TokenManager = require('../utils/tokenManager');
const { SECURITY_CONFIG } = require('../config/security');

// Protect routes with tenant context (PRODUCTION HARDENED)
exports.protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token || token === 'null' || token === 'undefined') {
    return res.status(401).json({
      success: false,
      message: 'Authentication failed. Please log in.',
      code: 'NO_TOKEN'
    });
  }

  try {
    // Use TokenManager for secure token verification
    const decoded = TokenManager.verifyAccessToken(token);
    
    // Get tenant-specific User model
    const TenantUser = getTenantModel(req, 'User', User.schema);
    const user = await TenantUser.findById(decoded.id).select('+auth +emailVerification');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please log in again.',
        code: 'USER_NOT_FOUND'
      });
    }

    // Verify user belongs to current tenant
    if (user.tenant.toString() !== req.tenantId.toString()) {
      await user.recordSuspiciousActivity('cross_tenant_access', 
        'Attempted access to different tenant', req.ip);
      
      return res.status(403).json({
        success: false,
        message: 'Access denied for this tenant',
        code: 'TENANT_MISMATCH'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    
    if (err.message === 'Token has expired') {
      return res.status(401).json({
        success: false,
        message: 'Your session has expired. Please log in again.',
        code: 'TOKEN_EXPIRED'
      });
    }

    return res.status(401).json({
      success: false,
      message: 'Authentication failed. Please log in again.',
      code: 'AUTH_FAILED'
    });
  }
};

// Grant access to specific roles (ENHANCED SECURITY)
exports.authorize = (...roles) => {
  return (req, res, next) => {
    // Check if user object exists
    if (!req.user) {
      console.log('Authorization failed: No user object in request');
      return res.status(500).json({
        success: false,
        message: 'Server error: User not authenticated properly',
        code: 'NO_USER_OBJECT'
      });
    }

    // Check if user has required role
    if (!roles.includes(req.user.role)) {
      console.log(`Authorization failed: User ${req.user._id} with role ${req.user.role} attempted to access route restricted to ${roles.join(', ')}`);
      
      // Log unauthorized access attempt
      req.user.recordSuspiciousActivity('unauthorized_access', 
        `Attempted to access ${roles.join(', ')} restricted route`, req.ip);
      
      return res.status(403).json({
        success: false,
        message: `Access denied. This route requires ${roles.length > 1 ? 'one of these roles' : 'the role'}: ${roles.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRoles: roles,
        userRole: req.user.role
      });
    }

    // User has required role, proceed
    console.log(`User ${req.user._id} with role ${req.user.role} authorized to access route`);
    next();
  };
};

// Rate limiting middleware for sensitive operations
exports.sensitiveOperation = (req, res, next) => {
  // Additional checks for sensitive operations
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required for sensitive operation',
      code: 'AUTH_REQUIRED'
    });
  }

  // Check if user has been active recently
  const lastActivity = req.user.auth?.lastLogin;
  if (lastActivity && (Date.now() - lastActivity.getTime()) > SECURITY_CONFIG.session.inactivityTimeout) {
    return res.status(403).json({
      success: false,
      message: 'Session expired due to inactivity. Please log in again.',
      code: 'SESSION_EXPIRED'
    });
  }

  // Check for suspicious activity before allowing sensitive operations
  if (req.user.hasSuspiciousActivity(req.ip)) {
    return res.status(403).json({
      success: false,
      message: 'Additional verification required due to suspicious activity.',
      code: 'SUSPICIOUS_ACTIVITY'
    });
  }

  next();
};
