const AbsenceFineTracking = require('../models/AbsenceFineTracking');
const Student = require('../models/Student');

// @desc    Calculate enhanced absence fine for a student
// @route   POST /api/absence-fine/calculate
// @access  Private
exports.calculateAbsenceFine = async (req, res) => {
  try {
    const { studentId, year, month, absenceCount } = req.body;

    // Validate required fields
    if (!studentId || !year || !month || absenceCount === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Please provide studentId, year, month, and absenceCount'
      });
    }

    // Validate student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Find or create absence fine tracking record
    let tracking = await AbsenceFineTracking.findOne({ student: studentId });
    if (!tracking) {
      tracking = new AbsenceFineTracking({
        student: studentId,
        consecutiveMonthsWithExcessiveAbsences: 0,
        lastExcessiveAbsenceMonth: null,
        monthlyAbsenceHistory: []
      });
    }

    // Calculate fine for this month
    const fineCalculation = tracking.calculateFineForMonth(year, month, absenceCount);

    // Update tracking data
    tracking.updateTrackingData(year, month, absenceCount, fineCalculation);

    // Save the updated tracking record
    await tracking.save();

    // Prepare response with detailed information
    const response = {
      fineAmount: fineCalculation.fineAmount,
      consecutiveMonthNumber: fineCalculation.consecutiveMonthNumber,
      absenceCount,
      allowedAbsences: 3,
      baseFine: 500,
      details: generateFineDetails(absenceCount, fineCalculation),
      monthlyHistory: tracking.monthlyAbsenceHistory.slice(0, 6) // Last 6 months
    };

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (err) {
    console.error('Error calculating absence fine:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while calculating absence fine'
    });
  }
};

// @desc    Get absence fine history for a student
// @route   GET /api/absence-fine/history/:studentId
// @access  Private
exports.getAbsenceFineHistory = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Find tracking record
    const tracking = await AbsenceFineTracking.findOne({ student: studentId })
      .populate('student', 'rollNumber user')
      .populate('student.user', 'name');

    if (!tracking) {
      return res.status(200).json({
        success: true,
        data: {
          student: studentId,
          consecutiveMonthsWithExcessiveAbsences: 0,
          monthlyHistory: []
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        student: tracking.student,
        consecutiveMonthsWithExcessiveAbsences: tracking.consecutiveMonthsWithExcessiveAbsences,
        lastExcessiveAbsenceMonth: tracking.lastExcessiveAbsenceMonth,
        monthlyHistory: tracking.monthlyAbsenceHistory
      }
    });

  } catch (err) {
    console.error('Error fetching absence fine history:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching absence fine history'
    });
  }
};

// @desc    Reset consecutive absence counter for a student
// @route   PUT /api/absence-fine/reset/:studentId
// @access  Private (Admin/Principal only)
exports.resetAbsenceCounter = async (req, res) => {
  try {
    const { studentId } = req.params;

    // Validate student exists
    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }

    // Find tracking record
    let tracking = await AbsenceFineTracking.findOne({ student: studentId });
    if (!tracking) {
      return res.status(404).json({
        success: false,
        message: 'No absence tracking record found for this student'
      });
    }

    // Reset the counter
    tracking.consecutiveMonthsWithExcessiveAbsences = 0;
    tracking.lastExcessiveAbsenceMonth = null;
    await tracking.save();

    res.status(200).json({
      success: true,
      message: 'Consecutive absence counter reset successfully',
      data: {
        student: studentId,
        consecutiveMonthsWithExcessiveAbsences: 0
      }
    });

  } catch (err) {
    console.error('Error resetting absence counter:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while resetting absence counter'
    });
  }
};

// Helper function to generate detailed fine explanation
function generateFineDetails(absenceCount, fineCalculation) {
  const ALLOWED_ABSENCES = 3;
  const BASE_FINE = 500;

  if (absenceCount <= ALLOWED_ABSENCES) {
    return `${absenceCount} absences (within allowed limit of ${ALLOWED_ABSENCES}) - No fine`;
  }

  if (fineCalculation.consecutiveMonthNumber === 1) {
    return `${absenceCount} absences (exceeds limit) - Base fine of ₹${BASE_FINE} applied`;
  }

  const multiplier = fineCalculation.consecutiveMonthNumber;
  return `${absenceCount} absences (exceeds limit) - ${multiplier}${getOrdinalSuffix(multiplier)} consecutive month with excessive absences - Fine: ₹${BASE_FINE} × ${multiplier} = ₹${fineCalculation.fineAmount}`;
}

// Helper function to get ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
function getOrdinalSuffix(number) {
  const j = number % 10;
  const k = number % 100;
  
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}
