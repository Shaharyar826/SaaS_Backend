const mongoose = require('mongoose');

const AbsenceFineTrackingSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: [true, 'Please provide a student ID'],
    unique: true
  },
  consecutiveMonthsWithExcessiveAbsences: {
    type: Number,
    default: 0,
    min: 0
  },
  lastExcessiveAbsenceMonth: {
    type: Date,
    default: null
  },
  monthlyAbsenceHistory: [{
    year: {
      type: Number,
      required: true
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12
    },
    absenceCount: {
      type: Number,
      required: true,
      min: 0
    },
    hadExcessiveAbsences: {
      type: Boolean,
      required: true
    },
    fineAmount: {
      type: Number,
      required: true,
      min: 0
    },
    consecutiveMonthNumber: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
AbsenceFineTrackingSchema.index({ student: 1 });
AbsenceFineTrackingSchema.index({ 'monthlyAbsenceHistory.year': 1, 'monthlyAbsenceHistory.month': 1 });

// Method to calculate fine for a given month
AbsenceFineTrackingSchema.methods.calculateFineForMonth = function(year, month, absenceCount) {
  const BASE_FINE = 500;
  const ALLOWED_ABSENCES = 3;
  
  // If absences are within allowed limit, no fine
  if (absenceCount <= ALLOWED_ABSENCES) {
    return {
      fineAmount: 0,
      consecutiveMonthNumber: 0,
      shouldResetCounter: true
    };
  }
  
  // Check if this is a consecutive month
  let consecutiveMonthNumber = 1;
  
  if (this.lastExcessiveAbsenceMonth) {
    const lastMonth = new Date(this.lastExcessiveAbsenceMonth);
    const currentMonth = new Date(year, month - 1, 1); // month is 1-indexed, Date constructor expects 0-indexed
    
    // Calculate if this is the next consecutive month
    const expectedNextMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 1);
    
    if (currentMonth.getTime() === expectedNextMonth.getTime()) {
      // This is a consecutive month
      consecutiveMonthNumber = this.consecutiveMonthsWithExcessiveAbsences + 1;
    } else {
      // Gap in excessive absence months, reset counter
      consecutiveMonthNumber = 1;
    }
  }
  
  // Calculate fine based on consecutive month number
  const fineAmount = BASE_FINE * consecutiveMonthNumber;
  
  return {
    fineAmount,
    consecutiveMonthNumber,
    shouldResetCounter: false
  };
};

// Method to update tracking data after calculating fine
AbsenceFineTrackingSchema.methods.updateTrackingData = function(year, month, absenceCount, fineCalculation) {
  const ALLOWED_ABSENCES = 3;
  const hadExcessiveAbsences = absenceCount > ALLOWED_ABSENCES;
  
  // Update consecutive months counter
  if (fineCalculation.shouldResetCounter) {
    this.consecutiveMonthsWithExcessiveAbsences = 0;
    this.lastExcessiveAbsenceMonth = null;
  } else {
    this.consecutiveMonthsWithExcessiveAbsences = fineCalculation.consecutiveMonthNumber;
    this.lastExcessiveAbsenceMonth = new Date(year, month - 1, 1);
  }
  
  // Add or update monthly history
  const existingEntryIndex = this.monthlyAbsenceHistory.findIndex(
    entry => entry.year === year && entry.month === month
  );
  
  const historyEntry = {
    year,
    month,
    absenceCount,
    hadExcessiveAbsences,
    fineAmount: fineCalculation.fineAmount,
    consecutiveMonthNumber: fineCalculation.consecutiveMonthNumber
  };
  
  if (existingEntryIndex >= 0) {
    // Update existing entry
    this.monthlyAbsenceHistory[existingEntryIndex] = historyEntry;
  } else {
    // Add new entry
    this.monthlyAbsenceHistory.push(historyEntry);
  }
  
  // Sort history by year and month (most recent first)
  this.monthlyAbsenceHistory.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.month - a.month;
  });
  
  // Keep only last 12 months of history to prevent unlimited growth
  if (this.monthlyAbsenceHistory.length > 12) {
    this.monthlyAbsenceHistory = this.monthlyAbsenceHistory.slice(0, 12);
  }
};

module.exports = mongoose.model('AbsenceFineTracking', AbsenceFineTrackingSchema);
