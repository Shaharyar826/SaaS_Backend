const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  employeeId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    immutable: true // This ensures the field cannot be modified after creation
  },
  dateOfBirth: {
    type: Date,
    required: [true, 'Please add date of birth']
  },
  gender: {
    type: String,
    required: [true, 'Please add gender'],
    enum: ['male', 'female', 'other']
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  phoneNumber: {
    type: String,
    required: [true, 'Please add a phone number']
  },
  qualification: {
    type: String,
    required: [true, 'Please add qualification']
  },
  experience: {
    type: Number,
    required: [true, 'Please add years of experience']
  },
  subjects: [{
    type: String,
    required: [true, 'Please add at least one subject']
  }],
  classes: [{
    type: String
  }],
  joiningDate: {
    type: Date,
    default: Date.now
  },
  salary: {
    type: Number,
    required: [true, 'Please add salary amount']
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for attendance records
TeacherSchema.virtual('attendanceRecords', {
  ref: 'Attendance',
  localField: '_id',
  foreignField: 'userId',
  justOne: false,
  match: { userType: 'teacher', userModel: 'Teacher' }
});

// Virtual for salary records
TeacherSchema.virtual('salaryRecords', {
  ref: 'Salary',
  localField: '_id',
  foreignField: 'teacher',
  justOne: false
});

// Compound indexes for efficient tenant-scoped queries
TeacherSchema.index({ tenant: 1, employeeId: 1 }, { unique: true });
TeacherSchema.index({ tenant: 1, isActive: 1 });
TeacherSchema.index({ tenant: 1, subjects: 1 });
TeacherSchema.index({ tenant: 1, classes: 1 });
TeacherSchema.index({ tenant: 1, user: 1 });

module.exports = mongoose.model('Teacher', TeacherSchema);
