const mongoose = require('mongoose');
const { getLastDateOfMonthForDate } = require('../utils/dateHelpers');

const FeeSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  feeType: {
    type: String,
    required: [true, 'Please add fee type'],
    enum: ['tuition', 'exam', 'transport', 'library', 'laboratory', 'other']
  },
  amount: {
    type: Number,
    required: [true, 'Please add amount']
  },
  monthlyFee: {
    type: Number,
    default: 0
  },
  absenceFine: {
    type: Number,
    default: 0
  },
  otherAdjustments: {
    type: Number,
    default: 0
  },
  dueDate: {
    type: Date,
    required: [true, 'Please add due date']
  },
  paymentDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'check', 'online', 'bank transfer', 'other']
  },
  transactionId: {
    type: String
  },
  status: {
    type: String,
    required: [true, 'Please add payment status'],
    enum: ['paid', 'unpaid', 'partial', 'overdue'],
    default: 'unpaid'
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number,
    default: function () {
      return this.amount || 0;
    }
  },
  receiptNumber: {
    type: String
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

// Helper method to calculate total amount
FeeSchema.methods.getTotalAmount = function () {
  return this.amount || 0;
};

// Unified status calculation logic
FeeSchema.statics.calculateFeeStatus = function (fee) {
  const currentAmount = fee.amount || 0;
  const paidAmount = fee.paidAmount || 0;
  const currentDate = new Date();
  const dueDate = new Date(fee.dueDate);

  if (paidAmount >= currentAmount) {
    return 'paid';
  } else if (paidAmount > 0) {
    return 'partial';
  } else if (dueDate < currentDate) {
    return 'overdue';
  } else {
    return 'unpaid';
  }
};

// Pre-save hook with unified logic
FeeSchema.pre('save', function (next) {
  // Ensure due date is last date of month
  if (this.isModified('dueDate') && this.dueDate) {
    this.dueDate = getLastDateOfMonthForDate(this.dueDate);
  }

  // Preserve monthlyFee if not set
  if (!this.monthlyFee && this.amount) {
    this.monthlyFee = this.amount;
  }

  // Recalculate amount if breakdown fields are modified
  if (this.isModified('monthlyFee') || this.isModified('absenceFine') || this.isModified('otherAdjustments')) {
    const baseAmount = this.monthlyFee || 0;
    this.amount = baseAmount + (this.absenceFine || 0) + (this.otherAdjustments || 0);
  }

  // Calculate remainingAmount
  this.remainingAmount = Math.max(0, this.amount - (this.paidAmount || 0));

  // Use unified status calculation
  this.status = this.constructor.calculateFeeStatus(this);

  // Set paymentDate only if fully paid and not already set
  if (this.status === 'paid' && !this.paymentDate) {
    this.paymentDate = new Date();
  }

  next();
});

// Method to get overall student fee status
FeeSchema.statics.getStudentOverallStatus = function (fees) {
  if (!fees || fees.length === 0) return 'no_fees';

  const hasOverdue = fees.some(fee => fee.status === 'overdue');
  const hasUnpaid = fees.some(fee => fee.status === 'unpaid');
  const hasPartial = fees.some(fee => fee.status === 'partial');

  if (hasOverdue) return 'overdue';
  if (hasUnpaid) return 'unpaid';
  if (hasPartial) return 'partial';
  return 'paid';
};

// Compound indexes for efficient tenant-scoped queries
FeeSchema.index({ tenant: 1, student: 1, dueDate: -1 });
FeeSchema.index({ tenant: 1, status: 1 });
FeeSchema.index({ tenant: 1, feeType: 1 });
FeeSchema.index({ tenant: 1, paymentDate: -1 });
FeeSchema.index({ tenant: 1, createdAt: -1 });

module.exports = mongoose.model('Fee', FeeSchema);