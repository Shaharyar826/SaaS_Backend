const express = require('express');
const {
  getStudents,
  getStudent,
  createStudent,
  updateStudent,
  deleteStudent
} = require('../controllers/student.controller');

const { protect, authorize } = require('../middleware/auth');
const { extractTenant, switchTenantDB } = require('../middleware/tenant');
const { checkTenantFeature } = require('../middleware/tenantFeatures');
const { checkSubscriptionLimits } = require('../middleware/subscriptionLimits');
const { checkFeatureAccess, checkResourceLimit } = require('../middleware/featureAccess');
const { checkStudentLimit } = require('../middleware/studentLimit');
const { checkPortalAccess } = require('../middleware/portalAccess');
const { FEATURES } = require('../config/features');

const router = express.Router();

// Apply tenant middleware to all routes
router.use(extractTenant);
router.use(switchTenantDB);

router
  .route('/')
  .get(protect, checkPortalAccess('student'), checkTenantFeature(FEATURES.STUDENTS), getStudents)
  .post(protect, authorize('admin', 'principal'), checkPortalAccess('student'), checkTenantFeature(FEATURES.STUDENTS), checkStudentLimit, createStudent);

// Add student limit info endpoint
router.get('/limit-info', protect, async (req, res) => {
  try {
    const StudentLimitService = require('../services/studentLimitService');
    const limitCheck = await StudentLimitService.canAddStudents(req.user.tenant, 0);
    res.json({ success: true, data: limitCheck });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching limit info' });
  }
});

router
  .route('/:id')
  .get(protect, checkPortalAccess('student'), checkTenantFeature(FEATURES.STUDENTS), getStudent)
  .put(protect, authorize('admin', 'principal', 'teacher', 'student'), checkPortalAccess('student'), checkTenantFeature(FEATURES.STUDENTS), updateStudent)
  .delete(protect, authorize('admin', 'principal'), checkPortalAccess('student'), checkTenantFeature(FEATURES.STUDENTS), deleteStudent);

module.exports = router;
