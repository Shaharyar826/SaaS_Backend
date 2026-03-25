const mongoose = require('mongoose');
const Fee = require('../models/Fee');
require('dotenv').config({ path: '../.env' });

const fixMonthlyFeeField = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all fee records that don't have monthlyFee set or have it as 0
    const feesWithoutMonthlyFee = await Fee.find({
      $or: [
        { monthlyFee: { $exists: false } },
        { monthlyFee: 0 },
        { monthlyFee: null }
      ]
    });

    console.log(`Found ${feesWithoutMonthlyFee.length} fee records without proper monthlyFee field`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const fee of feesWithoutMonthlyFee) {
      try {
        // Calculate the original monthly fee by subtracting fines from amount
        const originalAmount = fee.amount || 0;
        const absenceFine = fee.absenceFine || 0;
        const otherAdjustments = fee.otherAdjustments || 0;
        
        // The monthly fee should be the amount minus any fines
        const monthlyFee = originalAmount - absenceFine - otherAdjustments;
        
        // Only update if the calculated monthly fee is positive
        if (monthlyFee > 0) {
          await Fee.findByIdAndUpdate(fee._id, {
            monthlyFee: monthlyFee
          }, { runValidators: false });
          
          updatedCount++;
          
          if (updatedCount % 100 === 0) {
            console.log(`Updated ${updatedCount} records...`);
          }
        } else {
          // If calculated monthly fee is 0 or negative, use the original amount
          await Fee.findByIdAndUpdate(fee._id, {
            monthlyFee: originalAmount
          }, { runValidators: false });
          
          updatedCount++;
          console.log(`Fixed fee record ${fee._id} with amount ${originalAmount}`);
        }
      } catch (error) {
        console.error(`Error updating fee ${fee._id}:`, error.message);
        skippedCount++;
      }
    }

    console.log(`\nMigration completed:`);
    console.log(`- Total records processed: ${feesWithoutMonthlyFee.length}`);
    console.log(`- Successfully updated: ${updatedCount}`);
    console.log(`- Skipped due to errors: ${skippedCount}`);

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

// Run the migration
fixMonthlyFeeField();