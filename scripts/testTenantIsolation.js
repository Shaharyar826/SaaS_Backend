const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Student = require('../models/Student');
require('dotenv').config();

const testTenantIsolation = async () => {
  try {
    // Connect to main database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to main database');

    // Get all tenants
    const tenants = await Tenant.find().limit(2);
    console.log(`Found ${tenants.length} tenants`);

    for (const tenant of tenants) {
      console.log(`\n--- Testing Tenant: ${tenant.subdomain} ---`);
      
      // Connect to tenant database
      const tenantDbUri = process.env.MONGODB_URI.replace(
        /\/[^\/]*\?/, 
        `/${tenant.databaseName}?`
      );
      
      const tenantConnection = mongoose.createConnection(tenantDbUri);
      const TenantUser = tenantConnection.model('User', User.schema);
      const TenantStudent = tenantConnection.model('Student', Student.schema);

      // Count users and students for this tenant
      const userCount = await TenantUser.countDocuments({ tenant: tenant._id });
      const studentCount = await TenantStudent.countDocuments({ tenant: tenant._id });
      
      console.log(`Users: ${userCount}`);
      console.log(`Students: ${studentCount}`);
      
      // Get sample data
      const sampleUsers = await TenantUser.find({ tenant: tenant._id }).limit(3).select('firstName lastName role');
      console.log('Sample users:', sampleUsers.map(u => `${u.firstName} ${u.lastName} (${u.role})`));
      
      tenantConnection.close();
    }

    console.log('\n✅ Tenant isolation test completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
};

testTenantIsolation();