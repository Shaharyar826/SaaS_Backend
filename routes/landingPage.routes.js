const express = require('express');
const {
  getFeaturedTeachers,
  getFeaturedTeacher,
  createFeaturedTeacher,
  updateFeaturedTeacher,
  deleteFeaturedTeacher,
  getLandingPageEvents,
  getLandingPageEvent,
  createLandingPageEvent,
  updateLandingPageEvent,
  deleteLandingPageEvent,
  getTestimonials,
  getTestimonial,
  createTestimonial,
  updateTestimonial,
  deleteTestimonial,
  getLandingPageContent,
  getActiveTeachersForSelection
} = require('../controllers/landingPage.controller');

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
router.get('/content', getLandingPageContent);

// Get active teachers for selection
router.get('/active-teachers', protect, authorize('admin', 'principal'), getActiveTeachersForSelection);

// Protected routes - Featured Teachers
router
  .route('/teachers')
  .get(protect, authorize('admin', 'principal'), getFeaturedTeachers)
  .post(
    protect,
    authorize('admin', 'principal'),
    upload.single('image'),
    (req, res, next) => {
      req.body.imageType = 'profile';
      next();
    },
    uploadImage,
    createFeaturedTeacher
  );

router
  .route('/teachers/:id')
  .get(protect, authorize('admin', 'principal'), getFeaturedTeacher)
  .put(
    protect,
    authorize('admin', 'principal'),
    upload.single('image'),
    (req, res, next) => {
      req.body.imageType = 'profile';
      next();
    },
    uploadImage,
    updateFeaturedTeacher
  )
  .delete(protect, authorize('admin', 'principal'), deleteFeaturedTeacher);

// Protected routes - Landing Page Events
router
  .route('/events')
  .get(protect, authorize('admin', 'principal'), getLandingPageEvents)
  .post(
    protect,
    authorize('admin', 'principal'),
    upload.single('image'),
    (req, res, next) => {
      req.body.imageType = 'event';
      next();
    },
    uploadImage,
    createLandingPageEvent
  );

router
  .route('/events/:id')
  .get(protect, authorize('admin', 'principal'), getLandingPageEvent)
  .put(
    protect,
    authorize('admin', 'principal'),
    upload.single('image'),
    (req, res, next) => {
      req.body.imageType = 'event';
      next();
    },
    uploadImage,
    updateLandingPageEvent
  )
  .delete(protect, authorize('admin', 'principal'), deleteLandingPageEvent);

// Protected routes - Testimonials
router
  .route('/testimonials')
  .get(protect, authorize('admin', 'principal'), getTestimonials)
  .post(
    protect,
    authorize('admin', 'principal'),
    upload.single('image'),
    (req, res, next) => {
      req.body.imageType = 'profile';
      next();
    },
    uploadImage,
    createTestimonial
  );

router
  .route('/testimonials/:id')
  .get(protect, authorize('admin', 'principal'), getTestimonial)
  .put(
    protect,
    authorize('admin', 'principal'),
    upload.single('image'),
    (req, res, next) => {
      req.body.imageType = 'profile';
      next();
    },
    uploadImage,
    updateTestimonial
  )
  .delete(protect, authorize('admin', 'principal'), deleteTestimonial);

module.exports = router;
