const express = require('express');
const {
  getGalleryImages,
  getGalleryImage,
  createGalleryImage,
  updateGalleryImage,
  deleteGalleryImage
} = require('../controllers/gallery.controller');

const { protect, authorize } = require('../middleware/auth');
const multer = require('multer');
const { uploadImage } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Configure multer for handling file uploads
const uploadMulter = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Not an image! Please upload an image.'), false);
    }
  }
});

// Public routes
router.get('/', getGalleryImages);
router.get('/:id', getGalleryImage);

// Protected routes - Admin and Principal only
router.use(protect);
router.use(authorize('admin', 'principal'));

// Create gallery image with Cloudinary upload
router.post('/', uploadMulter.single('image'), (req, res, next) => {
  req.body.imageType = 'gallery';
  next();
}, uploadImage, createGalleryImage);

// Update gallery image with optional Cloudinary upload
router.put('/:id', uploadMulter.single('image'), (req, res, next) => {
  if (req.file) {
    req.body.imageType = 'gallery';
    next();
  } else {
    next();
  }
}, uploadImage, updateGalleryImage);

// Delete gallery image
router.delete('/:id', deleteGalleryImage);

module.exports = router;
