const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { uploadToR2, deleteFromR2 } = require('../controllers/r2Upload.controller');

// Use express.raw() on this route so we get the raw Buffer (not parsed JSON)
router.post(
  '/',
  protect,
  authorize('admin', 'principal'),
  express.raw({ type: '*/*', limit: '10mb' }),
  uploadToR2
);

router.delete(
  '/:key(*)',
  protect,
  authorize('admin', 'principal'),
  deleteFromR2
);

module.exports = router;
