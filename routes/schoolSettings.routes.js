const express = require('express');
const {
  getPublicSchoolSettings,
  getSchoolSettings,
  updateSchoolSettings,
  uploadHeroImage
} = require('../controllers/schoolSettings.controller');

const { protect, authorize } = require('../middleware/auth');
const { uploadImage } = require('../middleware/uploadMiddleware');
const multer = require('multer');

// Configure multer for memory storage (for Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  fileFilter: (req, file, cb) => {
    // Accept image files only
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(file.originalname.split('.').pop().toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif) are allowed!'), false);
    }
  }
});

const router = express.Router();

// Public routes
router.get('/public', getPublicSchoolSettings);

// Protected routes - Admin and Principal only
router.get(
  '/',
  protect,
  authorize('admin', 'principal'),
  getSchoolSettings
);

router.put(
  '/',
  protect,
  authorize('admin', 'principal'),
  updateSchoolSettings
);

router.post(
  '/hero-image',
  protect,
  authorize('admin', 'principal'),
  upload.single('heroImage'),
  (req, res, next) => {
    req.body.imageType = 'banner';
    next();
  },
  uploadImage,
  uploadHeroImage
);

module.exports = router;
