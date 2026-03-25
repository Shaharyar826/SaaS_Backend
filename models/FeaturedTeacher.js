const mongoose = require('mongoose');

const FeaturedTeacherSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add teacher name'],
    trim: true
  },
  designation: {
    type: String,
    required: [true, 'Please add designation'],
    trim: true
  },
  qualification: {
    type: String,
    required: [true, 'Please add qualification'],
    trim: true
  },
  experience: {
    type: Number,
    required: [true, 'Please add years of experience']
  },
  subjects: [{
    type: String
  }],
  bio: {
    type: String,
    required: [true, 'Please add a short bio'],
    trim: true
  },
  image: {
    type: String,
    default: 'default-avatar.jpg'
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  section: {
    type: String,
    enum: ['leadership', 'departmentHead', 'teachingStaff'],
    required: true
  },
  department: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('FeaturedTeacher', FeaturedTeacherSchema);
