const express = require('express');
const {
  uploadStudents,
  uploadTeachers,
  uploadAdminStaff,
  uploadSupportStaff,
  getUploadHistory,
  getStudentTemplate,
  getTeacherTemplate,
  getAdminStaffTemplate,
  getSupportStaffTemplate
} = require('../controllers/upload.controller');

const { protect, authorize } = require('../middleware/auth');
const { checkStudentLimit } = require('../middleware/studentLimit');
const multer = require('multer');
const { uploadImage, deleteImage } = require('../middleware/uploadMiddleware');

const router = express.Router();

// Configure multer for handling image uploads
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

// Configure multer for handling Excel/CSV file uploads (memory storage — Worker compatible)
const uploadExcel = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
    fileFilter: (req, file, cb) => {
        // Allowed file types for bulk uploads
        const filetypes = /xlsx|xls|csv/;
        const validMimeTypes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            'text/csv'
        ];

        // Check extension
        const extname = filetypes.test(file.originalname.split('.').pop().toLowerCase());

        // Check mime type
        const mimetype = validMimeTypes.includes(file.mimetype) || filetypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error(`Only Excel (.xlsx, .xls) and CSV files are allowed! Received: ${file.mimetype}`), false);
        }
    }
});

// Public template routes (no authentication required)
router.get('/template/student', getStudentTemplate);
router.get('/template/teacher', getTeacherTemplate);
router.get('/template/admin-staff', getAdminStaffTemplate);
router.get('/template/support-staff', getSupportStaffTemplate);

// Image upload routes
router.post('/image/:type', protect, uploadMulter.single('image'), (req, res, next) => {
    // Set the image type from the URL parameter
    req.body.imageType = req.params.type;
    next();
}, uploadImage, async (req, res) => {
    try {
        if (!req.cloudinaryUrl) {
            return res.status(400).json({
                success: false,
                message: 'No image was uploaded'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                url: req.cloudinaryUrl,
                public_id: req.cloudinaryPublicId,
                metadata: req.cloudinaryMetadata
            }
        });
    } catch (error) {
        console.error('Error in image upload route:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading image'
        });
    }
});

// Delete image route
router.delete('/image/:publicId', protect, async (req, res) => {
    try {
        await deleteImage(req.params.publicId);
        res.status(200).json({
            success: true,
            message: 'Image deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting image:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting image'
        });
    }
});

// All other routes are protected and only accessible by admin
router.use(protect);
router.use(authorize('admin'));

// Upload routes
router.post('/students', uploadExcel.single('file'), checkStudentLimit, uploadStudents);
router.post('/teachers', uploadExcel.single('file'), uploadTeachers);
router.post('/admin-staff', uploadExcel.single('file'), uploadAdminStaff);
router.post('/support-staff', uploadExcel.single('file'), uploadSupportStaff);

// History route
router.get('/history', getUploadHistory);

module.exports = router;
