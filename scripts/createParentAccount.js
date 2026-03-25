const mongoose = require('mongoose');
const User = require('../models/User');
const Student = require('../models/Student');
const Parent = require('../models/Parent');
const Tenant = require('../models/Tenant');
require('dotenv').config();

const createParentAccount = async (tenantId, studentId, parentEmail, parentData) => {
  try {
    // Get tenant database
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const tenantDbUri = process.env.MONGODB_URI.replace(
      /\/[^\/]*\?/,
      `/${tenant.databaseName}?`
    );

    const tenantConnection = mongoose.createConnection(tenantDbUri);
    await new Promise((resolve, reject) => {
      tenantConnection.once('open', resolve);
      tenantConnection.once('error', reject);
    });

    const TenantUser = tenantConnection.model('User', User.schema);
    const TenantStudent = tenantConnection.model('Student', Student.schema);
    const TenantParent = tenantConnection.model('Parent', Parent.schema);

    // Check if student exists
    const student = await TenantStudent.findById(studentId);
    if (!student) {
      throw new Error('Student not found');
    }

    // Check if parent user already exists
    let parentUser = await TenantUser.findOne({ email: parentEmail, tenant: tenantId });

    if (!parentUser) {
      // Create new parent user
      parentUser = new TenantUser({
        tenant: tenantId,
        firstName: parentData.firstName,
        lastName: parentData.lastName,
        email: parentEmail,
        password: parentData.password || 'Parent@123',
        role: 'parent',
        status: 'active',
        isApproved: true,
        phone: parentData.phone,
        emailVerification: {
          isVerified: true,
          verifiedAt: new Date()
        }
      });
      await parentUser.save();
      console.log('Parent user created:', parentUser.email);
    }

    // Check if parent profile exists
    let parent = await TenantParent.findOne({ user: parentUser._id, tenant: tenantId });

    if (!parent) {
      // Create parent profile
      parent = new TenantParent({
        tenant: tenantId,
        user: parentUser._id,
        children: [studentId],
        relationship: parentData.relationship || 'guardian',
        occupation: parentData.occupation
      });
      await parent.save();
      console.log('Parent profile created');
    } else {
      // Add child if not already linked
      if (!parent.children.includes(studentId)) {
        parent.children.push(studentId);
        await parent.save();
        console.log('Child linked to existing parent');
      }
    }

    await tenantConnection.close();
    return { success: true, parentUser, parent };
  } catch (error) {
    console.error('Error creating parent account:', error);
    throw error;
  }
};

// Example usage
const linkParentToStudent = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Example: Link parent to student
    const result = await createParentAccount(
      'TENANT_ID_HERE',
      'STUDENT_ID_HERE',
      'parent@example.com',
      {
        firstName: 'John',
        lastName: 'Doe',
        password: 'SecurePassword123',
        relationship: 'father',
        occupation: 'Engineer',
        phone: { full: '+1234567890' }
      }
    );

    console.log('Parent account created successfully:', result);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

// Uncomment to run
// linkParentToStudent();

module.exports = { createParentAccount };
