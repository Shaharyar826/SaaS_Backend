const express = require('express');
const {
  generateFeeReceipt,
  uploadFeeReceipt,
  extractDataFromReceipt
} = require('../controllers/fee-receipt.controller');

const { protect, authorize } = require('../middleware/auth');
const multer = require('multer');

// Configure multer for PDF receipt uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  fileFilter: (req, file, cb) => {
    // Accept PDF files only for receipts
    if (file.mimetype === 'application/pdf') {
      return cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed for receipt uploads!'), false);
    }
  }
});

const router = express.Router();

// Generate fee receipt
router.route('/generate/:feeId')
  .get(protect, generateFeeReceipt);

// Upload and extract data from fee receipt
router.route('/upload')
  .post(protect, authorize('admin', 'principal', 'accountant'), upload.single('file'), uploadFeeReceipt);

// Extract data from an already uploaded receipt
router.route('/extract/:receiptId')
  .get(protect, authorize('admin', 'principal', 'accountant'), extractDataFromReceipt);

module.exports = router;
