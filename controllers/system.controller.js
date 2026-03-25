const mongoose = require('mongoose');
const { createDefaultAccounts } = require('../utils/seeder');

// @desc    Reset database (clear all data but keep structure)
// @route   POST /api/system/reset-database
// @access  Private/Admin
exports.resetDatabase = async (req, res) => {
  try {
    // Get all collections
    const collections = await mongoose.connection.db.collections();
    
    // Drop each collection except system collections
    for (let collection of collections) {
      const collectionName = collection.collectionName;
      
      // Skip system collections
      if (collectionName.startsWith('system.')) {
        continue;
      }
      
      await mongoose.connection.db.dropCollection(collectionName);
      console.log(`Dropped collection: ${collectionName}`);
    }
    
    // Re-create default admin accounts
    await createDefaultAccounts();
    
    res.status(200).json({
      success: true,
      message: 'Database has been reset successfully. Default admin accounts have been recreated.'
    });
  } catch (err) {
    console.error('Error resetting database:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to reset database',
      error: err.message
    });
  }
};
