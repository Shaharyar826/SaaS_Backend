const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
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
  rollNumber: {
    type: String,
    required: [true, 'Please add a roll number'],
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
  class: {
    type: String,
    required: [true, 'Please add class']
  },
  section: {
    type: String,
    required: [true, 'Please add section']
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  parentInfo: {
    fatherName: {
      type: String,
      required: [true, "Please add father's name"]
    },
    motherName: {
      type: String,
      required: [true, "Please add mother's name"]
    },
    guardianName: String,
    contactNumber: {
      type: String,
      required: [true, 'Please add a contact number']
    },
    email: String,
    occupation: String
  },
  admissionDate: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  monthlyFee: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for attendance records
StudentSchema.virtual('attendanceRecords', {
  ref: 'Attendance',
  localField: '_id',
  foreignField: 'userId',
  justOne: false,
  match: { userType: 'student', userModel: 'Student' }
});

// Virtual for fee records
StudentSchema.virtual('feeRecords', {
  ref: 'Fee',
  localField: '_id',
  foreignField: 'student',
  justOne: false
});

// Cascade delete middleware - delete associated fee records when student is deleted
StudentSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const Fee = mongoose.model('Fee');
    await Fee.deleteMany({ student: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

StudentSchema.pre('findOneAndDelete', async function(next) {
  try {
    const Fee = mongoose.model('Fee');
    const doc = await this.model.findOne(this.getQuery());
    if (doc) {
      await Fee.deleteMany({ student: doc._id });
    }
    next();
  } catch (error) {
    next(error);
  }
});

StudentSchema.pre('findByIdAndDelete', async function(next) {
  try {
    const Fee = mongoose.model('Fee');
    const doc = await this.model.findById(this.getQuery()._id);
    if (doc) {
      await Fee.deleteMany({ student: doc._id });
    }
    next();
  } catch (error) {
    next(error);
  }
});

StudentSchema.pre('deleteMany', async function(next) {
  try {
    const Fee = mongoose.model('Fee');
    const docs = await this.model.find(this.getQuery());
    const studentIds = docs.map(doc => doc._id);
    if (studentIds.length > 0) {
      await Fee.deleteMany({ student: { $in: studentIds } });
    }
    next();
  } catch (error) {
    next(error);
  }
});

StudentSchema.pre('remove', async function(next) {
  try {
    const Fee = mongoose.model('Fee');
    await Fee.deleteMany({ student: this._id });
    next();
  } catch (error) {
    next(error);
  }
});

// Compound indexes for efficient tenant-scoped queries
StudentSchema.index({ tenant: 1, rollNumber: 1 }, { unique: true });
StudentSchema.index({ tenant: 1, class: 1, section: 1 });
StudentSchema.index({ tenant: 1, isActive: 1 });
StudentSchema.index({ tenant: 1, admissionDate: -1 });
StudentSchema.index({ tenant: 1, user: 1 });

module.exports = mongoose.model('Student', StudentSchema);
