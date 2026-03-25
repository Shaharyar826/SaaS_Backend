// Backend feature constants - must match frontend config/features.js
const FEATURES = {
  STUDENTS: 'students',
  TEACHERS: 'teachers',
  ADMIN_STAFF: 'admin_staff',
  ATTENDANCE: 'attendance',
  FEES: 'fees',
  SALARIES: 'salaries',
  EVENTS: 'events',
  MEETINGS: 'meetings',
  BULK_UPLOAD: 'bulk_upload',
  CONTACT_MESSAGES: 'contact_messages',
  HISTORY: 'history',
  SCHOOL_SETTINGS: 'school_settings',
  CONTENT_MANAGEMENT: 'content_management',
  RESULTS: 'results'
};

// Default features for new tenants
const DEFAULT_FEATURES = [FEATURES.STUDENTS, FEATURES.TEACHERS];

// Feature validation rules
const FEATURE_ROLES = {
  [FEATURES.STUDENTS]: ['admin', 'principal', 'vice-principal', 'teacher'],
  [FEATURES.TEACHERS]: ['admin', 'principal', 'vice-principal'],
  [FEATURES.ADMIN_STAFF]: ['admin', 'principal'],
  [FEATURES.ATTENDANCE]: ['admin', 'principal', 'vice-principal', 'teacher', 'student'],
  [FEATURES.FEES]: ['admin', 'principal', 'accountant', 'student'],
  [FEATURES.SALARIES]: ['admin', 'principal', 'accountant'],
  [FEATURES.EVENTS]: ['admin', 'principal', 'vice-principal', 'teacher', 'student', 'accountant'],
  [FEATURES.MEETINGS]: ['admin', 'principal', 'vice-principal', 'teacher'],
  [FEATURES.BULK_UPLOAD]: ['admin'],
  [FEATURES.CONTACT_MESSAGES]: ['admin', 'principal'],
  [FEATURES.HISTORY]: ['admin', 'principal'],
  [FEATURES.SCHOOL_SETTINGS]: ['admin', 'principal'],
  [FEATURES.CONTENT_MANAGEMENT]: ['admin', 'principal'],
  [FEATURES.RESULTS]: ['admin', 'principal', 'teacher', 'student', 'parent']
};

module.exports = {
  FEATURES,
  DEFAULT_FEATURES,
  FEATURE_ROLES
};