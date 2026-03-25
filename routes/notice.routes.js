const express = require('express');
const {
  getNotices,
  getNotice,
  createNotice,
  updateNotice,
  deleteNotice
} = require('../controllers/notice.controller');

const { protect, authorize } = require('../middleware/auth');
const { extractTenant, switchTenantDB } = require('../middleware/tenant');
const multer = require('multer');
const { uploadImage } = require('../middleware/uploadMiddleware');

// Configure multer for memory storage (for Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  fileFilter: (req, file, cb) => {
    // Accept image files and PDFs
    const filetypes = /jpeg|jpg|png|gif|pdf/;
    const extname = filetypes.test(file.originalname.split('.').pop().toLowerCase());
    const mimetype = filetypes.test(file.mimetype) || file.mimetype === 'application/pdf';

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files (jpeg, jpg, png, gif) and PDF files are allowed!'), false);
    }
  }
});

const router = express.Router();

// Apply tenant middleware to all routes
router.use(extractTenant);
router.use(switchTenantDB);

// Public routes
router
  .route('/')
  .get(getNotices);

router
  .route('/:id')
  .get(getNotice);

// Protected routes
router
  .route('/')
  .post(
    protect,
    authorize('admin', 'principal'),
    upload.single('attachmentFile'),
    (req, res, next) => {
      // Set image type for Cloudinary folder organization
      if (req.file) {
        req.body.imageType = req.body.type === 'event' ? 'event' : 'notice';
      }
      next();
    },
    uploadImage,
    createNotice
  );

router
  .route('/:id')
  .put(
    protect,
    authorize('admin', 'principal'),
    upload.single('attachmentFile'),
    (req, res, next) => {
      // Set image type for Cloudinary folder organization
      if (req.file) {
        req.body.imageType = req.body.type === 'event' ? 'event' : 'notice';
      }
      next();
    },
    uploadImage,
    updateNotice
  )
  .delete(
    protect,
    authorize('admin', 'principal'),
    deleteNotice
  );

module.exports = router;
