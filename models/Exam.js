const mongoose = require('mongoose');

const ExamSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  examType: {
    type: String,
    enum: ['midterm', 'final', 'unit_test', 'quiz', 'assignment'],
    required: true
  },
  class: {
    type: String,
    required: true
  },
  section: {
    type: String,
    required: true
  },
  subjects: [{
    name: String,
    maxMarks: Number,
    passingMarks: Number
  }],
  startDate: Date,
  endDate: Date,
  status: {
    type: String,
    enum: ['draft', 'ongoing', 'completed', 'published'],
    default: 'draft'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

ExamSchema.index({ tenant: 1, class: 1, section: 1 });
ExamSchema.index({ tenant: 1, status: 1 });

module.exports = mongoose.model('Exam', ExamSchema);
