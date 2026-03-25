const express = require('express');
const { resetDatabase } = require('../controllers/system.controller');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// System administration routes - Admin only
router.post(
  '/reset-database',
  protect,
  authorize('admin'),
  resetDatabase
);

module.exports = router;
