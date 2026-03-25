const express = require('express');
const { uploadProfileImage, deleteProfileImage } = require('../controllers/profileImage.controller');
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

// All routes are protected
router.use(protect);

// Upload profile image route (for current user)
router.post('/upload', uploadMulter.single('profileImage'), (req, res, next) => {
  req.body.imageType = 'profile';
  next();
}, uploadImage, uploadProfileImage);

// Upload profile image route for other users (admin only)
router.post('/upload/:userId', authorize('admin', 'principal'), uploadMulter.single('profileImage'), (req, res, next) => {
  req.body.imageType = 'profile';
  req.body.targetUserId = req.params.userId; // Pass the target user ID
  next();
}, uploadImage, uploadProfileImage);

// Delete profile image route
router.delete('/', deleteProfileImage);

module.exports = router;
