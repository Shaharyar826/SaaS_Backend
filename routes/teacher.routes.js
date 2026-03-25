const express = require('express');
const {
  getTeachers,
  getTeacher,
  getTeacherProfile,
  createTeacher,
  updateTeacher,
  updateOwnProfile,
  deleteTeacher
} = require('../controllers/teacher.controller');

const { protect, authorize } = require('../middleware/auth');
const { extractTenant, switchTenantDB } = require('../middleware/tenant');
const { checkTenantFeature } = require('../middleware/tenantFeatures');
const { checkSubscriptionLimits } = require('../middleware/subscriptionLimits');
const { checkPortalAccess } = require('../middleware/portalAccess');
const { FEATURES } = require('../config/features');

const router = express.Router();

// Apply tenant middleware to all routes
router.use(extractTenant);
router.use(switchTenantDB);

router
  .route('/')
  .get(protect, checkPortalAccess('teacher'), checkTenantFeature(FEATURES.TEACHERS), getTeachers)
  .post(protect, authorize('admin', 'principal'), checkPortalAccess('teacher'), checkTenantFeature(FEATURES.TEACHERS), checkSubscriptionLimits('teacher'), createTeacher);

router
  .route('/profile')
  .get(protect, authorize('teacher'), checkPortalAccess('teacher'), checkTenantFeature(FEATURES.TEACHERS), getTeacherProfile)
  .put(protect, authorize('teacher'), checkPortalAccess('teacher'), checkTenantFeature(FEATURES.TEACHERS), updateOwnProfile);

router
  .route('/:id')
  .get(protect, checkPortalAccess('teacher'), checkTenantFeature(FEATURES.TEACHERS), getTeacher)
  .put(protect, authorize('admin', 'principal'), checkPortalAccess('teacher'), checkTenantFeature(FEATURES.TEACHERS), updateTeacher)
  .delete(protect, authorize('admin', 'principal'), checkPortalAccess('teacher'), checkTenantFeature(FEATURES.TEACHERS), deleteTeacher);

module.exports = router;
