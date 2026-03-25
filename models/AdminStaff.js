const mongoose = require('mongoose');

const AdminStaffSchema = new mongoose.Schema({
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
    enum: ['admin', 'principal', 'accountant', 'clerk', 'receptionist', 'librarian', 'lab-assistant', 'office-assistant', 'other']
  },
  department: {
    type: String,
    required: [true, 'Please add department']
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
  joiningDate: {
    type: Date,
    default: Date.now
  },
  salary: {
    type: Number,
    required: [true, 'Please add salary amount']
  },
  responsibilities: [{
    type: String
  }],
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
AdminStaffSchema.virtual('attendanceRecords', {
  ref: 'Attendance',
  localField: '_id',
  foreignField: 'userId',
  justOne: false,
  match: { userType: 'admin-staff', userModel: 'AdminStaff' }
});

// Virtual for salary records
AdminStaffSchema.virtual('salaryRecords', {
  ref: 'Salary',
  localField: '_id',
  foreignField: 'adminStaff',
  justOne: false
});

module.exports = mongoose.model('AdminStaff', AdminStaffSchema);
