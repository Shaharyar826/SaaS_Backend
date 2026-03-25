const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Please add a date'],
    default: Date.now
  },
  // Single user reference with type
  userType: {
    type: String,
    required: [true, 'Please specify user type'],
    enum: ['student', 'teacher', 'admin-staff', 'support-staff']
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Please provide a user ID'],
    refPath: 'userModel'
  },
  userModel: {
    type: String,
    required: [true, 'Please specify user model'],
    enum: ['Student', 'Teacher', 'AdminStaff', 'SupportStaff']
  },
  status: {
    type: String,
    required: [true, 'Please add attendance status'],
    enum: ['present', 'absent', 'late', 'half-day', 'leave']
  },
  remarks: {
    type: String
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Attendance', AttendanceSchema);
