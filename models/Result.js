const mongoose = require('mongoose');

const ResultSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Exam',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  marks: [{
    subject: String,
    marksObtained: Number,
    maxMarks: Number,
    grade: String,
    remarks: String
  }],
  totalMarks: Number,
  totalMaxMarks: Number,
  percentage: Number,
  grade: String,
  rank: Number,
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
  },
  publishedAt: Date,
  enteredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

ResultSchema.index({ tenant: 1, exam: 1, student: 1 }, { unique: true });
ResultSchema.index({ tenant: 1, student: 1 });
ResultSchema.index({ tenant: 1, status: 1 });

module.exports = mongoose.model('Result', ResultSchema);
