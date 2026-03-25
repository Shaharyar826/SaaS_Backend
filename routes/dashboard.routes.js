const express = require('express');
const {
  getDashboardMetrics,
  getAdminDashboardMetrics,
  getTeacherDashboardMetrics,
  getStudentDashboardMetrics
} = require('../controllers/dashboard.controller');

const { protect, authorize } = require('../middleware/auth');
const { extractTenant, switchTenantDB } = require('../middleware/tenant');

const router = express.Router();

// Apply tenant middleware to all dashboard routes
router.use(extractTenant);
router.use(switchTenantDB);

router.get('/metrics', protect, getDashboardMetrics);
router.get('/admin-metrics', protect, authorize('admin', 'principal'), getAdminDashboardMetrics);
router.get('/teacher-metrics', protect, authorize('teacher'), getTeacherDashboardMetrics);
router.get('/student-metrics', protect, authorize('student'), getStudentDashboardMetrics);

module.exports = router;
