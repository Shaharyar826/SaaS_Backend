const mongoose = require('mongoose');

const SalarySchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  staffType: {
    type: String,
    required: [true, 'Please specify staff type'],
    enum: ['teacher', 'admin-staff', 'support-staff']
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Teacher',
    required: function() {
      return this.staffType === 'teacher';
    },
    default: null
  },
  adminStaff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminStaff',
    required: function() {
      return this.staffType === 'admin-staff';
    },
    default: null
  },
  supportStaff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SupportStaff',
    required: function() {
      return this.staffType === 'support-staff';
    },
    default: null
  },
  month: {
    type: String,
    required: [true, 'Please add month'],
    match: [/^(0[1-9]|1[0-2])\/\d{4}$/, 'Please use format MM/YYYY']
  },
  amount: {
    type: Number,
    required: [true, 'Please add amount']
  },
  paymentDate: {
    type: Date
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'check', 'bank transfer', 'online', 'other']
  },
  transactionId: {
    type: String
  },
  status: {
    type: String,
    required: [true, 'Please add payment status'],
    enum: ['paid', 'unpaid', 'partial', 'processing'],
    default: 'unpaid'
  },
  paidAmount: {
    type: Number,
    default: 0
  },
  remainingAmount: {
    type: Number,
    default: function() {
      return this.amount;
    }
  },
  deductions: [{
    reason: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    }
  }],
  bonuses: [{
    reason: {
      type: String,
      required: true
    },
    amount: {
      type: Number,
      required: true
    }
  }],
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

// Calculate final amount after deductions and bonuses
SalarySchema.pre('save', function(next) {
  let totalDeductions = 0;
  let totalBonuses = 0;

  if (this.deductions && this.deductions.length > 0) {
    totalDeductions = this.deductions.reduce((sum, item) => sum + item.amount, 0);
  }

  if (this.bonuses && this.bonuses.length > 0) {
    totalBonuses = this.bonuses.reduce((sum, item) => sum + item.amount, 0);
  }

  this.amount = this.amount + totalBonuses - totalDeductions;

  // Update remaining amount when paid amount changes
  if (this.isModified('paidAmount')) {
    this.remainingAmount = this.amount - this.paidAmount;

    // Update status based on payment
    if (this.paidAmount === 0) {
      this.status = 'unpaid';
    } else if (this.paidAmount < this.amount) {
      this.status = 'partial';
    } else if (this.paidAmount >= this.amount) {
      this.status = 'paid';
      this.paymentDate = this.paymentDate || Date.now();
    }
  }

  next();
});

module.exports = mongoose.model('Salary', SalarySchema);
