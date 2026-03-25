const express = require('express');
const {
  getFeeRecords,
  getFeeRecord,
  createFeeRecord,
  updateFeeRecord,
  deleteFeeRecord,
  getStudentArrears,
  processAggregatedPayment,
  getStudentAggregatedFees,
  generateMonthlyFees,
  getFeeHistory,
  getStudentFeeStatement,
  cleanupOrphanedFees
} = require('../controllers/fee.controller');

const { protect, authorize } = require('../middleware/auth');
const { extractTenant, switchTenantDB } = require('../middleware/tenant');
const { checkTenantFeature } = require('../middleware/tenantFeatures');
const { checkFeatureAccess } = require('../middleware/featureAccess');

const router = express.Router();

// Apply tenant middleware to all routes
router.use(extractTenant);
router.use(switchTenantDB);

// Protected routes with feature access control
router.use(protect);
router.use(checkTenantFeature('fees')); // All fee routes require fees feature

// Basic CRUD operations
router.route('/')
  .get(getFeeRecords)
  .post(authorize('admin', 'principal', 'accountant'), createFeeRecord);

router.route('/:id')
  .get(getFeeRecord)
  .put(authorize('admin', 'principal', 'accountant'), updateFeeRecord)
  .delete(authorize('admin', 'principal'), deleteFeeRecord);

// Student-specific routes
router.get('/arrears/:studentId', authorize('admin', 'principal', 'accountant', 'student'), getStudentArrears);
router.get('/student-aggregate/:studentId', authorize('admin', 'principal', 'accountant'), getStudentAggregatedFees);
router.get('/history/:studentId', authorize('admin', 'principal', 'accountant', 'student'), getFeeHistory);
router.get('/statement/:studentId', authorize('admin', 'principal', 'accountant', 'student'), getStudentFeeStatement);

// Payment processing
router.put('/process-aggregate-payment/:studentId', authorize('admin', 'principal', 'accountant'), processAggregatedPayment);

// Administrative operations
router.post('/generate-monthly', authorize('admin', 'principal'), generateMonthlyFees);
router.delete('/cleanup-orphaned', authorize('admin', 'principal'), cleanupOrphanedFees);

module.exports = router;