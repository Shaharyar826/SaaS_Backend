const express = require('express');
const {
  getAboutUsContent,
  updateAboutUsContent,
  uploadAboutUsBannerImage,
  uploadLeadershipPhoto,
  getAdmissionsContent,
  updateAdmissionsContent,
  uploadAdmissionsFile,
  deleteAdmissionsFile,
  getAcademicsContent,
  updateAcademicsContent,
  getFacultyContent,
  updateFacultyContent,
  uploadFacultyPhoto
} = require('../controllers/pageContent.controller');
const { protect, authorize } = require('../middleware/auth');
const { uploadImage } = require('../middleware/uploadMiddleware');
const multer = require('multer');
const path = require('path');

// Configure Multer for file uploads (using memory storage for Cloudinary)
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype === 'application/pdf' ||
    file.mimetype === 'application/msword' || // .doc
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only image files, PDFs, or Word documents are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

const router = express.Router();

// Public routes
router.get('/about', getAboutUsContent);
router.get('/admissions', getAdmissionsContent);
router.get('/academics', getAcademicsContent);
router.get('/faculty', getFacultyContent);

// Protected routes
router.put('/about', protect, authorize('admin', 'principal'), updateAboutUsContent);
router.post('/about/banner', protect, authorize('admin', 'principal'), upload.single('banner'), (req, res, next) => {
  req.body.imageType = 'banner';
  next();
}, uploadImage, uploadAboutUsBannerImage);
router.post('/about/leadership-photo/:memberIndex', protect, authorize('admin', 'principal'), upload.single('photo'), (req, res, next) => {
  req.body.imageType = 'profile';
  next();
}, uploadImage, uploadLeadershipPhoto);
router.put('/admissions', protect, authorize('admin', 'principal'), updateAdmissionsContent);
router.post('/admissions/file', protect, authorize('admin', 'principal'), upload.single('file'), (req, res, next) => {
  if (req.file && req.file.mimetype.startsWith('image/')) {
    req.body.imageType = 'misc';
    next();
  } else {
    next();
  }
}, uploadImage, uploadAdmissionsFile);
router.delete('/admissions/file/:filename', protect, authorize('admin', 'principal'), deleteAdmissionsFile);
router.put('/academics', protect, authorize('admin', 'principal'), updateAcademicsContent);
router.put('/faculty', protect, authorize('admin', 'principal'), updateFacultyContent);
router.post('/faculty/photo', protect, authorize('admin', 'principal'), upload.single('photo'), (req, res, next) => {
  req.body.imageType = 'profile';
  next();
}, uploadImage, uploadFacultyPhoto);

module.exports = router;