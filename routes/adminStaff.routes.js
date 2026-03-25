const express = require('express');
const {
  getAdminStaff,
  getAdminStaffMember,
  createAdminStaff,
  updateAdminStaff,
  deleteAdminStaff,
  getAdminStaffProfile,
  updateAdminStaffProfile
} = require('../controllers/adminStaff.controller');

const { protect, authorize } = require('../middleware/auth');
const { extractTenant, switchTenantDB } = require('../middleware/tenant');
const { checkTenantFeature } = require('../middleware/tenantFeatures');
const { FEATURES } = require('../config/features');

const router = express.Router();

// Apply tenant middleware to all routes
router.use(extractTenant);
router.use(switchTenantDB);

router
  .route('/')
  .get(protect, checkTenantFeature(FEATURES.ADMIN_STAFF), getAdminStaff)
  .post(protect, authorize('admin', 'principal'), checkTenantFeature(FEATURES.ADMIN_STAFF), createAdminStaff);

router
  .route('/profile')
  .get(protect, authorize('admin', 'principal'), checkTenantFeature(FEATURES.ADMIN_STAFF), getAdminStaffProfile)
  .put(protect, authorize('admin', 'principal'), checkTenantFeature(FEATURES.ADMIN_STAFF), updateAdminStaffProfile);

router
  .route('/:id')
  .get(protect, checkTenantFeature(FEATURES.ADMIN_STAFF), getAdminStaffMember)
  .put(protect, authorize('admin', 'principal'), checkTenantFeature(FEATURES.ADMIN_STAFF), updateAdminStaff)
  .delete(protect, authorize('admin'), checkTenantFeature(FEATURES.ADMIN_STAFF), deleteAdminStaff);

module.exports = router;
