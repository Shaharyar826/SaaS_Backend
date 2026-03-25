const mongoose = require('mongoose');
const Student = require('../models/Student');
const Fee = require('../models/Fee');

// Script to verify and clean up any existing orphaned fee records
async function verifyAndCleanOrphanedFees() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolms');
    console.log('Connected to MongoDB');

    console.log('Checking for orphaned fee records...');

    // Get all fee records with populated student data
    const allFees = await Fee.find({}).populate('student');
    console.log(`Total fee records found: ${allFees.length}`);

    // Find orphaned fees (fees where student is null or doesn't exist)
    const orphanedFees = allFees.filter(fee => !fee.student);
    console.log(`Orphaned fee records found: ${orphanedFees.length}`);

    if (orphanedFees.length > 0) {
      console.log('Orphaned fee record details:');
      orphanedFees.forEach((fee, index) => {
        console.log(`${index + 1}. Fee ID: ${fee._id}, Amount: ${fee.amount}, Due Date: ${fee.dueDate}, Status: ${fee.status}`);
      });

      // Clean up orphaned fees
      const orphanedFeeIds = orphanedFees.map(fee => fee._id);
      const deleteResult = await Fee.deleteMany({ _id: { $in: orphanedFeeIds } });
      
      console.log(`\n✅ Cleaned up ${deleteResult.deletedCount} orphaned fee records`);
    } else {
      console.log('✅ No orphaned fee records found. Database is clean!');
    }

    // Verify fee totals after cleanup
    const remainingFees = await Fee.find({});
    const totalAmount = remainingFees.reduce((sum, fee) => sum + (fee.remainingAmount || fee.amount), 0);
    
    console.log(`\nFinal statistics:`);
    console.log(`- Total fee records: ${remainingFees.length}`);
    console.log(`- Total outstanding amount: $${totalAmount}`);

    // Check if all remaining fees have valid students
    const feesWithValidStudents = await Fee.find({}).populate('student');
    const validFees = feesWithValidStudents.filter(fee => fee.student);
    
    console.log(`- Fee records with valid students: ${validFees.length}`);
    
    if (validFees.length === remainingFees.length) {
      console.log('✅ All remaining fee records have valid student references');
    } else {
      console.log('❌ Some fee records still have invalid student references');
    }

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the verification
verifyAndCleanOrphanedFees();