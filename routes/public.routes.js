const express = require('express');
const {
  getFeaturedTeachers,
  getPublicEventsNotices,
  getSchoolStats,
  getLandingPageData,
  getAllPublicContent
} = require('../controllers/public.controller');

const router = express.Router();

// All routes are public (no authentication required)
router.get('/teachers', getFeaturedTeachers);
router.get('/events-notices', getPublicEventsNotices);
router.get('/stats', getSchoolStats);
router.get('/landing-page', getLandingPageData);
router.get('/all-content', getAllPublicContent);

module.exports = router;
