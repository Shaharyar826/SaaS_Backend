const mongoose = require('mongoose');
const Student = require('../models/Student');
const Fee = require('../models/Fee');
const User = require('../models/User');

// Test script to verify cascade delete functionality
async function testCascadeDelete() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolms');
    console.log('Connected to MongoDB');

    // Create a test user
    const testUser = await User.create({
      firstName: 'Test',
      lastName: 'Student',
      name: 'Test Student',
      email: 'teststudent@schoolms.com',
      password: 'password123',
      role: 'student',
      isApproved: true,
      status: 'active'
    });

    // Create a test student
    const testStudent = await Student.create({
      user: testUser._id,
      rollNumber: 'TEST001',
      dateOfBirth: new Date('2005-01-01'),
      gender: 'male',
      class: '10th',
      section: 'A',
      parentInfo: {
        fatherName: 'Test Father',
        motherName: 'Test Mother',
        contactNumber: '1234567890'
      },
      monthlyFee: 2500
    });

    console.log('Created test student:', testStudent._id);

    // Create some test fee records
    const testFees = await Fee.create([
      {
        student: testStudent._id,
        feeType: 'tuition',
        amount: 2500,
        dueDate: new Date(),
        status: 'unpaid',
        recordedBy: testUser._id
      },
      {
        student: testStudent._id,
        feeType: 'exam',
        amount: 500,
        dueDate: new Date(),
        status: 'unpaid',
        recordedBy: testUser._id
      }
    ]);

    console.log('Created test fee records:', testFees.map(f => f._id));

    // Verify fees exist before deletion
    const feesBeforeDelete = await Fee.find({ student: testStudent._id });
    console.log('Fee records before deletion:', feesBeforeDelete.length);

    // Delete the student (this should trigger cascade delete)
    await testStudent.deleteOne();
    console.log('Deleted test student');

    // Check if fee records were automatically deleted
    const feesAfterDelete = await Fee.find({ student: testStudent._id });
    console.log('Fee records after deletion:', feesAfterDelete.length);

    // Clean up test user
    await User.findByIdAndDelete(testUser._id);

    if (feesAfterDelete.length === 0) {
      console.log('✅ SUCCESS: Cascade delete is working correctly!');
      console.log('All fee records were automatically deleted when student was deleted.');
    } else {
      console.log('❌ FAILURE: Cascade delete is not working!');
      console.log('Fee records still exist after student deletion.');
    }

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the test
testCascadeDelete();