const mongoose = require('mongoose');

const ReceiptDataSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true
  },
  // Legacy field for backward compatibility
  path: {
    type: String,
    required: false
  },
  // Cloudinary fields
  cloudinaryUrl: {
    type: String,
    required: false
  },
  cloudinaryPublicId: {
    type: String,
    required: false
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  extractedData: {
    studentName: String,
    studentId: mongoose.Schema.Types.ObjectId,
    feeType: String,
    amount: Number,
    dueDate: Date,
    description: String
  },
  status: {
    type: String,
    enum: ['pending', 'processed', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('ReceiptData', ReceiptDataSchema);
