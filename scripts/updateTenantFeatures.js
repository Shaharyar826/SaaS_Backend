const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const { FEATURES, DEFAULT_FEATURES } = require('../config/features');

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/sms_saas');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

// Update tenant features
const updateTenantFeatures = async (subdomain, features) => {
  try {
    const tenant = await Tenant.findOne({ subdomain });
    
    if (!tenant) {
      console.error(`Tenant with subdomain '${subdomain}' not found`);
      return;
    }

    // Initialize settings if not exists
    if (!tenant.settings) {
      tenant.settings = {};
    }
    if (!tenant.settings.features) {
      tenant.settings.features = {};
    }

    // Update enabled features
    tenant.settings.features.enabled = features;
    
    await tenant.save();
    
    console.log(`Updated features for tenant '${subdomain}':`, features);
  } catch (error) {
    console.error('Error updating tenant features:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node updateTenantFeatures.js <subdomain> <feature1,feature2,...>');
    console.log('Available features:', Object.values(FEATURES).join(', '));
    console.log('Example: node updateTenantFeatures.js cbhstj students,teachers,fees');
    process.exit(1);
  }
  
  const subdomain = args[0];
  const featuresInput = args[1];
  
  let features;
  if (featuresInput === 'all') {
    features = Object.values(FEATURES);
  } else if (featuresInput === 'default') {
    features = DEFAULT_FEATURES;
  } else {
    features = featuresInput.split(',').map(f => f.trim());
    
    // Validate features
    const invalidFeatures = features.filter(f => !Object.values(FEATURES).includes(f));
    if (invalidFeatures.length > 0) {
      console.error('Invalid features:', invalidFeatures);
      console.log('Available features:', Object.values(FEATURES).join(', '));
      process.exit(1);
    }
  }
  
  await updateTenantFeatures(subdomain, features);
  
  mongoose.connection.close();
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { updateTenantFeatures };