const validator = require('validator');
const xss = require('xss');
const { validationPatterns, SECURITY_CONFIG } = require('../config/security');

class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// Sanitize input to prevent XSS
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return xss(input.trim(), {
    whiteList: {}, // No HTML tags allowed
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script']
  });
};

// Validate email format and security
const validateEmail = (email) => {
  if (!email) throw new ValidationError('Email is required', 'email');
  
  const sanitized = sanitizeInput(email).toLowerCase();
  
  if (!validationPatterns.email.test(sanitized)) {
    throw new ValidationError('Invalid email format', 'email');
  }
  
  if (sanitized.length > 254) {
    throw new ValidationError('Email too long', 'email');
  }
  
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\+.*\+/, // Multiple plus signs
    /\.{2,}/, // Multiple consecutive dots
    /@.*@/, // Multiple @ symbols
  ];
  
  if (suspiciousPatterns.some(pattern => pattern.test(sanitized))) {
    throw new ValidationError('Invalid email format', 'email');
  }
  
  return sanitized;
};

// Validate password strength
const validatePassword = (password, confirmPassword = null) => {
  if (!password) throw new ValidationError('Password is required', 'password');
  
  const config = SECURITY_CONFIG.password;
  
  if (password.length < config.minLength) {
    throw new ValidationError(`Password must be at least ${config.minLength} characters long`, 'password');
  }
  
  if (password.length > 128) {
    throw new ValidationError('Password too long', 'password');
  }
  
  if (config.requireUppercase && !/[A-Z]/.test(password)) {
    throw new ValidationError('Password must contain at least one uppercase letter', 'password');
  }
  
  if (config.requireLowercase && !/[a-z]/.test(password)) {
    throw new ValidationError('Password must contain at least one lowercase letter', 'password');
  }
  
  if (config.requireNumbers && !/\d/.test(password)) {
    throw new ValidationError('Password must contain at least one number', 'password');
  }
  
  if (config.requireSpecialChars && !new RegExp(`[${config.specialChars.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}]`).test(password)) {
    throw new ValidationError('Password must contain at least one special character', 'password');
  }
  
  // Check for common weak patterns
  const weakPatterns = [
    /^(..).*\1/, // Repeated characters
    /123456|654321|qwerty|password|letmein/i, // Common passwords (removed 'admin')
    /(.)\1{2,}/, // Three or more consecutive identical characters
  ];
  
  if (weakPatterns.some(pattern => pattern.test(password))) {
    throw new ValidationError('Password contains weak patterns', 'password');
  }
  
  if (confirmPassword !== null && password !== confirmPassword) {
    throw new ValidationError('Passwords do not match', 'confirmPassword');
  }
  
  return password;
};

// Validate phone number (international format)
const validatePhoneNumber = (phoneNumber, fieldName = 'phone number') => {
  if (!phoneNumber) return null;
  
  const sanitized = sanitizeInput(phoneNumber).replace(/\s+/g, '');
  
  if (!/^\+[0-9]{7,15}$/.test(sanitized)) {
    throw new ValidationError('Invalid phone number format', fieldName);
  }
  
  return sanitized;
};

// Validate nationality
const validateNationality = (nationality, fieldName = 'nationality') => {
  if (!nationality) return null;
  
  const sanitized = sanitizeInput(nationality);
  
  if (!/^[a-zA-Z\s-]+$/.test(sanitized)) {
    throw new ValidationError('Nationality can only contain letters, spaces, and hyphens', fieldName);
  }
  
  if (sanitized.length > 50) {
    throw new ValidationError('Nationality cannot exceed 50 characters', fieldName);
  }
  
  return sanitized;
};

// Validate name fields
const validateName = (name, fieldName = 'name') => {
  if (!name) throw new ValidationError(`${fieldName} is required`, fieldName);
  
  const sanitized = sanitizeInput(name);
  
  if (!validationPatterns.name.test(sanitized)) {
    throw new ValidationError(`Invalid ${fieldName} format`, fieldName);
  }
  
  if (sanitized.length < 1 || sanitized.length > 50) {
    throw new ValidationError(`${fieldName} must be between 1 and 50 characters`, fieldName);
  }
  
  return sanitized;
};

// Validate subdomain
const validateSubdomain = (subdomain) => {
  if (!subdomain) throw new ValidationError('Subdomain is required', 'subdomain');
  
  const sanitized = sanitizeInput(subdomain).toLowerCase();
  
  if (!validationPatterns.subdomain.test(sanitized)) {
    throw new ValidationError('Subdomain can only contain lowercase letters, numbers, and hyphens', 'subdomain');
  }
  
  if (sanitized.length < 3 || sanitized.length > 63) {
    throw new ValidationError('Subdomain must be between 3 and 63 characters', 'subdomain');
  }
  
  // Reserved subdomains
  const reserved = [
    'www', 'api', 'admin', 'root', 'mail', 'ftp', 'localhost',
    'test', 'demo', 'staging', 'dev', 'app', 'support', 'help',
    'blog', 'news', 'shop', 'store', 'cdn', 'static', 'assets'
  ];
  
  if (reserved.includes(sanitized)) {
    throw new ValidationError('This subdomain is reserved', 'subdomain');
  }
  
  return sanitized;
};

// Validate school name
const validateSchoolName = (schoolName) => {
  if (!schoolName) throw new ValidationError('School name is required', 'schoolName');
  
  const sanitized = sanitizeInput(schoolName);
  
  if (sanitized.length < 2 || sanitized.length > 100) {
    throw new ValidationError('School name must be between 2 and 100 characters', 'schoolName');
  }
  
  // Allow letters, numbers, spaces, and common punctuation
  if (!/^[a-zA-Z0-9\s'.,&()-]+$/.test(sanitized)) {
    throw new ValidationError('School name contains invalid characters', 'schoolName');
  }
  
  return sanitized;
};

// Validate tenant identifier
const validateTenantIdentifier = (identifier) => {
  if (!identifier) throw new ValidationError('Tenant identifier is required', 'tenantIdentifier');
  
  const sanitized = sanitizeInput(identifier).toLowerCase();
  
  if (!validationPatterns.subdomain.test(sanitized)) {
    throw new ValidationError('Invalid tenant identifier format', 'tenantIdentifier');
  }
  
  return sanitized;
};

// Comprehensive registration validation
const validateRegistrationData = (data) => {
  const errors = {};
  const sanitized = {};
  
  try {
    sanitized.subdomain = validateSubdomain(data.subdomain);
  } catch (error) {
    errors.subdomain = error.message;
  }
  
  try {
    sanitized.schoolName = validateSchoolName(data.schoolName);
  } catch (error) {
    errors.schoolName = error.message;
  }
  
  try {
    sanitized.adminFirstName = validateName(data.adminFirstName, 'first name');
  } catch (error) {
    errors.adminFirstName = error.message;
  }
  
  try {
    sanitized.adminLastName = validateName(data.adminLastName, 'last name');
  } catch (error) {
    errors.adminLastName = error.message;
  }
  
  try {
    sanitized.adminEmail = validateEmail(data.adminEmail);
  } catch (error) {
    errors.adminEmail = error.message;
  }
  
  try {
    validatePassword(data.adminPassword, data.confirmPassword);
    sanitized.adminPassword = data.adminPassword;
  } catch (error) {
    errors.adminPassword = error.message;
  }
  
  // Optional fields
  try {
    if (data.nationality) {
      sanitized.nationality = validateNationality(data.nationality);
    }
  } catch (error) {
    errors.nationality = error.message;
  }
  
  try {
    if (data.phoneNumber) {
      sanitized.phoneNumber = validatePhoneNumber(data.phoneNumber);
    }
  } catch (error) {
    errors.phoneNumber = error.message;
  }
  
  if (Object.keys(errors).length > 0) {
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    error.errors = errors;
    throw error;
  }
  
  return sanitized;
};

// Comprehensive login validation
const validateLoginData = (data) => {
  const errors = {};
  const sanitized = {};
  
  try {
    sanitized.email = validateEmail(data.email);
  } catch (error) {
    errors.email = error.message;
  }
  
  if (!data.password) {
    errors.password = 'Password is required';
  } else {
    sanitized.password = data.password;
  }
  
  try {
    sanitized.tenantIdentifier = validateTenantIdentifier(data.tenantIdentifier);
  } catch (error) {
    errors.tenantIdentifier = error.message;
  }
  
  if (Object.keys(errors).length > 0) {
    const error = new Error('Validation failed');
    error.name = 'ValidationError';
    error.errors = errors;
    throw error;
  }
  
  return sanitized;
};

module.exports = {
  ValidationError,
  sanitizeInput,
  validateEmail,
  validatePassword,
  validateName,
  validateSubdomain,
  validateSchoolName,
  validateTenantIdentifier,
  validatePhoneNumber,
  validateNationality,
  validateRegistrationData,
  validateLoginData
};