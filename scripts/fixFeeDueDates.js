const mongoose = require('mongoose');
const Fee = require('../models/Fee');
const { getLastDateOfMonthForDate } = require('../utils/dateHelpers');

// Load environment variables
require('dotenv').config({ path: '../.env' });

const fixFeeDueDates = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all fee records
    const fees = await Fee.find({});
    console.log(`Found ${fees.length} fee records to check`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const fee of fees) {
      const currentDueDate = new Date(fee.dueDate);
      const correctDueDate = getLastDateOfMonthForDate(currentDueDate);
      
      // Check if the due date needs to be updated
      if (currentDueDate.getDate() !== correctDueDate.getDate()) {
        console.log(`Updating fee ${fee._id}: ${currentDueDate.toDateString()} -> ${correctDueDate.toDateString()}`);
        
        // Update due date and recalculate status for unpaid fees only
        const currentDate = new Date();
        let newStatus = fee.status;
        
        if (fee.status !== 'paid' && fee.remainingAmount > 0) {
          if (correctDueDate < currentDate) {
            newStatus = 'overdue';
          } else {
            newStatus = fee.paidAmount > 0 ? 'partial' : 'unpaid';
          }
        }
        
        await Fee.findByIdAndUpdate(fee._id, {
          dueDate: correctDueDate,
          status: newStatus
        }, { runValidators: false });
        
        updatedCount++;
      } else {
        // Even if due date is correct, check if status needs updating
        const currentDate = new Date();
        let correctStatus = fee.status;
        
        if (fee.status !== 'paid' && fee.remainingAmount > 0) {
          if (currentDueDate < currentDate) {
            correctStatus = 'overdue';
          } else {
            correctStatus = fee.paidAmount > 0 ? 'partial' : 'unpaid';
          }
        }
        
        if (correctStatus !== fee.status) {
          await Fee.findByIdAndUpdate(fee._id, {
            status: correctStatus
          }, { runValidators: false });
          updatedCount++;
        } else {
          skippedCount++;
        }
      }
    }

    console.log(`Migration completed:`);
    console.log(`- Updated: ${updatedCount} records`);
    console.log(`- Skipped: ${skippedCount} records (already correct)`);
    console.log(`- Total: ${fees.length} records processed`);

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  fixFeeDueDates();
}

module.exports = fixFeeDueDates;