const express = require('express');
const {
  calculateAbsenceFine,
  getAbsenceFineHistory,
  resetAbsenceCounter
} = require('../controllers/absence-fine.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Calculate absence fine for a student
router.route('/calculate')
  .post(protect, calculateAbsenceFine);

// Get absence fine history for a student
router.route('/history/:studentId')
  .get(protect, getAbsenceFineHistory);

// Reset consecutive absence counter (Admin/Principal only)
router.route('/reset/:studentId')
  .put(protect, authorize('admin', 'principal'), resetAbsenceCounter);

module.exports = router;
