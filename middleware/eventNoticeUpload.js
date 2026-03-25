const multer = require('multer');

// Configure multer for memory storage (for Cloudinary)
const eventNoticeUpload = multer({
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

module.exports = eventNoticeUpload;
