const express = require('express');
const {
  getUserTypes,
  getClasses,
  getSections,
  getFilteredUsers,
  getPublicClasses
} = require('../controllers/filter.controller');

const { protect } = require('../middleware/auth');

const router = express.Router();

// Public routes (no authentication required)
router.get('/public/classes', getPublicClasses);

// Protected routes (authentication required)
router.get('/user-types', protect, getUserTypes);
router.get('/classes', protect, getClasses);
router.get('/sections', protect, getSections);
router.get('/users', protect, getFilteredUsers);

module.exports = router;
