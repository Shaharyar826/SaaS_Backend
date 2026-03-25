const express = require('express');
const {
  getHistory,
  getEntityHistory,
  getHistorySummary
} = require('../controllers/history.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Protected routes - only admin and principal can access history
router.get('/summary', protect, authorize('admin', 'principal'), getHistorySummary);
router.get('/:entityType/:entityId', protect, authorize('admin', 'principal'), getEntityHistory);
router.get('/', protect, authorize('admin', 'principal'), getHistory);

module.exports = router;
