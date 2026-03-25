const express = require('express');
const router = express.Router();
const {
  getParentDashboard,
  getChildren,
  getChildFees,
  getChildAttendance,
  getNotices
} = require('../controllers/parent.controller');
const { protect, authorize } = require('../middleware/auth');
const { checkPortalAccess } = require('../middleware/portalAccess');

router.use(protect);
router.use(authorize('parent'));
router.use(checkPortalAccess('parent'));

router.get('/dashboard', getParentDashboard);
router.get('/children', getChildren);
router.get('/children/:childId/fees', getChildFees);
router.get('/children/:childId/attendance', getChildAttendance);
router.get('/notices', getNotices);

module.exports = router;
