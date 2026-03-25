const mongoose = require('mongoose');

const UploadHistorySchema = new mongoose.Schema({
  userType: {
    type: String,
    required: [true, 'Please specify user type'],
    enum: ['student', 'teacher', 'admin-staff', 'support-staff']
  },
  filename: {
    type: String,
    required: [true, 'Please provide filename']
  },
  originalFilename: {
    type: String,
    required: [true, 'Please provide original filename']
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['success', 'partial', 'failed'],
    required: true
  },
  totalRecords: {
    type: Number,
    default: 0
  },
  successCount: {
    type: Number,
    default: 0
  },
  errorCount: {
    type: Number,
    default: 0
  },
  errors: [{
    row: Number,
    message: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('UploadHistory', UploadHistorySchema);
