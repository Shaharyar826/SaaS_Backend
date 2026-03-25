const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const AdminStaff = require('../models/AdminStaff');
const Fee = require('../models/Fee');
const Attendance = require('../models/Attendance');

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

// Verify tenant isolation
const verifyTenantIsolation = async () => {
  try {
    console.log('🔍 Verifying Tenant Isolation...\n');

    // Get all tenants
    const tenants = await Tenant.find({});
    console.log(`Found ${tenants.length} tenants\n`);

    for (const tenant of tenants) {
      console.log(`📋 Checking tenant: ${tenant.schoolName} (${tenant.subdomain})`);
      
      // Get tenant connection
      const tenantDbUri = process.env.MONGODB_URI.replace(
        /\/[^\/]*\?/, 
        `/${tenant.databaseName}?`
      );
      
      const tenantConnection = mongoose.createConnection(tenantDbUri);
      
      // Wait for connection
      await new Promise((resolve, reject) => {
        tenantConnection.once('open', resolve);
        tenantConnection.once('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      const TenantUser = tenantConnection.model('User', User.schema);
      const TenantStudent = tenantConnection.model('Student', Student.schema);
      const TenantTeacher = tenantConnection.model('Teacher', Teacher.schema);
      const TenantAdminStaff = tenantConnection.model('AdminStaff', AdminStaff.schema);
      const TenantFee = tenantConnection.model('Fee', Fee.schema);
      const TenantAttendance = tenantConnection.model('Attendance', Attendance.schema);

      // Check user isolation
      const users = await TenantUser.find({});
      const usersWithWrongTenant = users.filter(user => 
        !user.tenant || user.tenant.toString() !== tenant._id.toString()
      );
      
      if (usersWithWrongTenant.length > 0) {
        console.log(`❌ Found ${usersWithWrongTenant.length} users with incorrect tenant ID`);
      } else {
        console.log(`✅ All ${users.length} users have correct tenant ID`);
      }

      // Check student isolation
      const students = await TenantStudent.find({});
      const studentsWithWrongTenant = students.filter(student => 
        !student.tenant || student.tenant.toString() !== tenant._id.toString()
      );
      
      if (studentsWithWrongTenant.length > 0) {
        console.log(`❌ Found ${studentsWithWrongTenant.length} students with incorrect tenant ID`);
      } else {
        console.log(`✅ All ${students.length} students have correct tenant ID`);
      }

      // Check teacher isolation
      const teachers = await TenantTeacher.find({});
      const teachersWithWrongTenant = teachers.filter(teacher => 
        !teacher.tenant || teacher.tenant.toString() !== tenant._id.toString()
      );
      
      if (teachersWithWrongTenant.length > 0) {
        console.log(`❌ Found ${teachersWithWrongTenant.length} teachers with incorrect tenant ID`);
      } else {
        console.log(`✅ All ${teachers.length} teachers have correct tenant ID`);
      }

      // Check admin staff isolation
      const adminStaff = await TenantAdminStaff.find({});
      const adminStaffWithWrongTenant = adminStaff.filter(staff => 
        !staff.tenant || staff.tenant.toString() !== tenant._id.toString()
      );
      
      if (adminStaffWithWrongTenant.length > 0) {
        console.log(`❌ Found ${adminStaffWithWrongTenant.length} admin staff with incorrect tenant ID`);
      } else {
        console.log(`✅ All ${adminStaff.length} admin staff have correct tenant ID`);
      }

      // Check fee isolation
      const fees = await TenantFee.find({});
      const feesWithWrongTenant = fees.filter(fee => 
        !fee.tenant || fee.tenant.toString() !== tenant._id.toString()
      );
      
      if (feesWithWrongTenant.length > 0) {
        console.log(`❌ Found ${feesWithWrongTenant.length} fees with incorrect tenant ID`);
      } else {
        console.log(`✅ All ${fees.length} fees have correct tenant ID`);
      }

      // Check attendance isolation
      const attendance = await TenantAttendance.find({});
      const attendanceWithWrongTenant = attendance.filter(record => 
        !record.tenant || record.tenant.toString() !== tenant._id.toString()
      );
      
      if (attendanceWithWrongTenant.length > 0) {
        console.log(`❌ Found ${attendanceWithWrongTenant.length} attendance records with incorrect tenant ID`);
      } else {
        console.log(`✅ All ${attendance.length} attendance records have correct tenant ID`);
      }

      // Check email uniqueness within tenant
      const emailCounts = {};
      users.forEach(user => {
        if (emailCounts[user.email]) {
          emailCounts[user.email]++;
        } else {
          emailCounts[user.email] = 1;
        }
      });

      const duplicateEmails = Object.keys(emailCounts).filter(email => emailCounts[email] > 1);
      if (duplicateEmails.length > 0) {
        console.log(`❌ Found ${duplicateEmails.length} duplicate emails within tenant: ${duplicateEmails.join(', ')}`);
      } else {
        console.log(`✅ All emails are unique within tenant`);
      }

      await tenantConnection.close();
      console.log('');
    }

    // Check cross-tenant email isolation
    console.log('🔍 Checking cross-tenant email isolation...');
    const allEmails = {};
    
    for (const tenant of tenants) {
      const tenantDbUri = process.env.MONGODB_URI.replace(
        /\/[^\/]*\?/, 
        `/${tenant.databaseName}?`
      );
      
      const tenantConnection = mongoose.createConnection(tenantDbUri);
      await new Promise((resolve, reject) => {
        tenantConnection.once('open', resolve);
        tenantConnection.once('error', reject);
        setTimeout(() => reject(new Error('Connection timeout')), 5000);
      });

      const TenantUser = tenantConnection.model('User', User.schema);
      const users = await TenantUser.find({});
      
      users.forEach(user => {
        if (allEmails[user.email]) {
          allEmails[user.email].push(tenant.subdomain);
        } else {
          allEmails[user.email] = [tenant.subdomain];
        }
      });

      await tenantConnection.close();
    }

    const crossTenantEmails = Object.keys(allEmails).filter(email => allEmails[email].length > 1);
    if (crossTenantEmails.length > 0) {
      console.log(`❌ Found ${crossTenantEmails.length} emails used across multiple tenants:`);
      crossTenantEmails.forEach(email => {
        console.log(`   ${email}: ${allEmails[email].join(', ')}`);
      });
    } else {
      console.log(`✅ All emails are properly isolated between tenants`);
    }

    console.log('\n✅ Tenant isolation verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  }
};

// Main function
const main = async () => {
  await connectDB();
  await verifyTenantIsolation();
  mongoose.connection.close();
};

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { verifyTenantIsolation };