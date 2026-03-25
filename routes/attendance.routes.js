const express = require('express');
const {
  getAttendanceRecords,
  getAttendanceRecord,
  createAttendanceRecord,
  updateAttendanceRecord,
  deleteAttendanceRecord,
  createTestAttendanceRecord,
  createBatchAttendanceRecords
} = require('../controllers/attendance.controller');

const { protect, authorize } = require('../middleware/auth');
const { extractTenant, switchTenantDB } = require('../middleware/tenant');
const { checkTenantFeature } = require('../middleware/tenantFeatures');

const router = express.Router();

// Apply tenant middleware to all routes
router.use(extractTenant);
router.use(switchTenantDB);

router
  .route('/')
  .get(protect, checkTenantFeature('attendance'), getAttendanceRecords)
  .post(protect, authorize('admin', 'principal', 'vice-principal', 'teacher'), checkTenantFeature('attendance'), createAttendanceRecord);

router
  .route('/batch')
  .post(protect, authorize('admin', 'principal', 'vice-principal', 'teacher'), checkTenantFeature('attendance'), createBatchAttendanceRecords);

router
  .route('/create-test')
  .get(protect, checkTenantFeature('attendance'), createTestAttendanceRecord);

router
  .route('/:id')
  .get(protect, checkTenantFeature('attendance'), getAttendanceRecord)
  .put(protect, authorize('admin', 'principal', 'vice-principal', 'teacher'), checkTenantFeature('attendance'), updateAttendanceRecord)
  .delete(protect, authorize('admin', 'principal'), checkTenantFeature('attendance'), deleteAttendanceRecord);

module.exports = router;
