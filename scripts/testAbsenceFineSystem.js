const mongoose = require('mongoose');
const dotenv = require('dotenv');
const AbsenceFineTracking = require('../models/AbsenceFineTracking');
const Student = require('../models/Student');

// Load env vars
dotenv.config();

// Connect to database
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
};

// Test the enhanced absence fine system
const testAbsenceFineSystem = async () => {
  try {
    await connectDB();

    // Find a test student (you can replace this with a specific student ID)
    const student = await Student.findOne().populate('user');
    if (!student) {
      console.log('No students found in database');
      return;
    }

    console.log(`Testing absence fine system for student: ${student.user.name} (${student.rollNumber})`);
    console.log('Student ID:', student._id);

    // Test scenarios
    const testScenarios = [
      { year: 2025, month: 5, absenceCount: 2, description: 'May 2025 - 2 absences (within limit)' },
      { year: 2025, month: 6, absenceCount: 5, description: 'June 2025 - 5 absences (1st month with excessive absences)' },
      { year: 2025, month: 7, absenceCount: 4, description: 'July 2025 - 4 absences (2nd consecutive month)' },
      { year: 2025, month: 8, absenceCount: 6, description: 'August 2025 - 6 absences (3rd consecutive month)' },
      { year: 2025, month: 9, absenceCount: 2, description: 'September 2025 - 2 absences (reset counter)' },
      { year: 2025, month: 10, absenceCount: 5, description: 'October 2025 - 5 absences (1st month after reset)' }
    ];

    // Clear existing tracking data for this student
    await AbsenceFineTracking.deleteOne({ student: student._id });

    let tracking = new AbsenceFineTracking({
      student: student._id,
      consecutiveMonthsWithExcessiveAbsences: 0,
      lastExcessiveAbsenceMonth: null,
      monthlyAbsenceHistory: []
    });

    console.log('\n=== Testing Enhanced Absence Fine System ===\n');

    for (const scenario of testScenarios) {
      console.log(`\n--- ${scenario.description} ---`);
      
      // Calculate fine for this month
      const fineCalculation = tracking.calculateFineForMonth(scenario.year, scenario.month, scenario.absenceCount);
      
      console.log(`Absences: ${scenario.absenceCount}`);
      console.log(`Fine Amount: ₹${fineCalculation.fineAmount}`);
      console.log(`Consecutive Month Number: ${fineCalculation.consecutiveMonthNumber}`);
      console.log(`Should Reset Counter: ${fineCalculation.shouldResetCounter}`);
      
      // Update tracking data
      tracking.updateTrackingData(scenario.year, scenario.month, scenario.absenceCount, fineCalculation);
      
      console.log(`Updated Consecutive Months: ${tracking.consecutiveMonthsWithExcessiveAbsences}`);
      console.log(`Last Excessive Absence Month: ${tracking.lastExcessiveAbsenceMonth}`);
    }

    // Save the tracking record
    await tracking.save();
    console.log('\n=== Test completed successfully ===');
    console.log('Tracking record saved to database');

    // Display final monthly history
    console.log('\n=== Monthly History ===');
    tracking.monthlyAbsenceHistory.forEach(entry => {
      console.log(`${entry.year}-${entry.month.toString().padStart(2, '0')}: ${entry.absenceCount} absences, ₹${entry.fineAmount} fine (${entry.consecutiveMonthNumber}${getOrdinalSuffix(entry.consecutiveMonthNumber)} consecutive month)`);
    });

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    mongoose.connection.close();
  }
};

// Helper function to get ordinal suffix
function getOrdinalSuffix(number) {
  if (number === 0) return '';
  
  const j = number % 10;
  const k = number % 100;
  
  if (j === 1 && k !== 11) return 'st';
  if (j === 2 && k !== 12) return 'nd';
  if (j === 3 && k !== 13) return 'rd';
  return 'th';
}

// Run the test
testAbsenceFineSystem();
