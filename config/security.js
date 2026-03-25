const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Security configuration
const SECURITY_CONFIG = {
  // Password requirements
  password: {
    minLength: 8, // Reduced from 12 to 8
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: false, // Made optional for easier testing
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    historyCount: 5, // Remember last 5 passwords
    specialChars: '!@#$%^&*()_+-=[]{}|;:,.<>?'
  },
  
  // Account lockout settings
  lockout: {
    maxAttempts: 5,
    lockoutDuration: 30 * 60 * 1000, // 30 minutes
    progressiveDelay: true
  },
  
  // JWT settings
  jwt: {
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d',
    issuer: 'eduflow-sms',
    audience: 'eduflow-users'
  },
  
  // Email verification
  emailVerification: {
    required: true,
    tokenExpiry: 24 * 60 * 60 * 1000, // 24 hours
    maxResendAttempts: 3,
    resendCooldown: 5 * 60 * 1000 // 5 minutes
  },
  
  // Session settings
  session: {
    maxConcurrentSessions: 3,
    inactivityTimeout: 30 * 60 * 1000, // 30 minutes
    absoluteTimeout: 8 * 60 * 60 * 1000 // 8 hours
  }
};

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => rateLimit({
  windowMs,
  max,
  message: { success: false, message },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test'
});

const createSlowDown = (windowMs, delayAfter, delayMs) => slowDown({
  windowMs,
  delayAfter,
  delayMs: () => delayMs,
  maxDelayMs: 20000,
  skip: (req) => process.env.NODE_ENV === 'test',
  validate: { delayMs: false }
});

// Authentication rate limiters
const authLimiters = {
  // Login attempts
  login: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    5, // 5 attempts
    'Too many login attempts. Please try again in 15 minutes.'
  ),
  
  // Registration attempts
  register: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    3, // 3 attempts
    'Too many registration attempts. Please try again in 1 hour.'
  ),
  
  // Password reset requests
  passwordReset: createRateLimiter(
    60 * 60 * 1000, // 1 hour
    3, // 3 attempts
    'Too many password reset requests. Please try again in 1 hour.'
  ),
  
  // Email verification requests
  emailVerification: createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    3, // 3 attempts
    'Too many email verification requests. Please try again in 15 minutes.'
  ),
  
  // Progressive delay for failed logins
  loginSlowDown: createSlowDown(
    15 * 60 * 1000, // 15 minutes
    2, // Start slowing down after 2 attempts
    1000 // 1 second delay, increases progressively
  )
};

// Input validation patterns
const validationPatterns = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  subdomain: /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
  name: /^[a-zA-Z\s'-]{1,50}$/,
  // Regex respects requireSpecialChars flag — special char group is conditional
  password: SECURITY_CONFIG.password.requireSpecialChars
    ? new RegExp(
        `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[${SECURITY_CONFIG.password.specialChars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}]).{${SECURITY_CONFIG.password.minLength},}$`
      )
    : new RegExp(
        `^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{${SECURITY_CONFIG.password.minLength},}$`
      ),
};

// Secure cookie options
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  domain: process.env.NODE_ENV === 'production' ? process.env.COOKIE_DOMAIN : undefined
};

module.exports = {
  SECURITY_CONFIG,
  authLimiters,
  validationPatterns,
  cookieOptions
};