const mongoose = require('mongoose');

const SupportStaffSchema = new mongoose.Schema({
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
    required: [true, 'Please add an employee ID'],
    unique: true,
    trim: true
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
  position: {
    type: String,
    required: [true, 'Please add position'],
    enum: ['janitor', 'security', 'gardener', 'driver', 'cleaner', 'cook', 'other']
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
  emergencyContact: {
    name: String,
    relationship: String,
    phoneNumber: String
  },
  experience: {
    type: Number,
    required: [true, 'Please add years of experience']
  },
  joiningDate: {
    type: Date,
    default: Date.now
  },
  salary: {
    type: Number,
    required: [true, 'Please add salary amount']
  },
  workingHours: {
    startTime: String,
    endTime: String,
    daysOfWeek: [String]
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
SupportStaffSchema.virtual('attendanceRecords', {
  ref: 'Attendance',
  localField: '_id',
  foreignField: 'userId',
  justOne: false,
  match: { userType: 'support-staff', userModel: 'SupportStaff' }
});

// Virtual for salary records
SupportStaffSchema.virtual('salaryRecords', {
  ref: 'Salary',
  localField: '_id',
  foreignField: 'supportStaff',
  justOne: false
});

module.exports = mongoose.model('SupportStaff', SupportStaffSchema);
