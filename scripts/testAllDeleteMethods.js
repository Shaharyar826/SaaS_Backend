const mongoose = require('mongoose');
const Student = require('../models/Student');
const Fee = require('../models/Fee');
const User = require('../models/User');

// Comprehensive test script to verify all cascade delete methods
async function testAllDeleteMethods() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/schoolms');
    console.log('Connected to MongoDB');

    // Test 1: deleteOne() method
    console.log('\n=== Testing deleteOne() method ===');
    await testDeleteMethod('deleteOne');

    // Test 2: findOneAndDelete() method
    console.log('\n=== Testing findOneAndDelete() method ===');
    await testDeleteMethod('findOneAndDelete');

    // Test 3: findByIdAndDelete() method
    console.log('\n=== Testing findByIdAndDelete() method ===');
    await testDeleteMethod('findByIdAndDelete');

    // Test 4: remove() method (deprecated but still supported)
    console.log('\n=== Testing remove() method ===');
    await testDeleteMethod('remove');

    // Test 5: deleteMany() method
    console.log('\n=== Testing deleteMany() method ===');
    await testBulkDelete();

    console.log('\n✅ All cascade delete tests completed!');

  } catch (error) {
    console.error('Error during tests:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

async function testDeleteMethod(method) {
  try {
    // Create test user
    const testUser = await User.create({
      firstName: 'Test',
      lastName: 'Student',
      name: 'Test Student',
      email: `test${method}@schoolms.com`,
      password: 'password123',
      role: 'student',
      isApproved: true,
      status: 'active'
    });

    // Create test student
    const testStudent = await Student.create({
      user: testUser._id,
      rollNumber: `TEST${method.toUpperCase()}`,
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

    // Create test fee records
    await Fee.create([
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

    // Count fees before deletion
    const feesBeforeDelete = await Fee.countDocuments({ student: testStudent._id });
    console.log(`Fees before ${method}:`, feesBeforeDelete);

    // Delete student using specified method
    switch (method) {
      case 'deleteOne':
        await testStudent.deleteOne();
        break;
      case 'findOneAndDelete':
        await Student.findOneAndDelete({ _id: testStudent._id });
        break;
      case 'findByIdAndDelete':
        await Student.findByIdAndDelete(testStudent._id);
        break;
      case 'remove':
        await testStudent.remove();
        break;
    }

    // Count fees after deletion
    const feesAfterDelete = await Fee.countDocuments({ student: testStudent._id });
    console.log(`Fees after ${method}:`, feesAfterDelete);

    // Clean up test user
    await User.findByIdAndDelete(testUser._id);

    if (feesAfterDelete === 0) {
      console.log(`✅ ${method}: SUCCESS - All fees deleted`);
    } else {
      console.log(`❌ ${method}: FAILURE - ${feesAfterDelete} fees remain`);
    }

  } catch (error) {
    console.error(`Error testing ${method}:`, error.message);
  }
}

async function testBulkDelete() {
  try {
    // Create multiple test users and students
    const testData = [];
    for (let i = 1; i <= 3; i++) {
      const testUser = await User.create({
        firstName: 'Bulk',
        lastName: `Student${i}`,
        name: `Bulk Student${i}`,
        email: `bulktest${i}@schoolms.com`,
        password: 'password123',
        role: 'student',
        isApproved: true,
        status: 'active'
      });

      const testStudent = await Student.create({
        user: testUser._id,
        rollNumber: `BULK${i}`,
        dateOfBirth: new Date('2005-01-01'),
        gender: 'male',
        class: '10th',
        section: 'B',
        parentInfo: {
          fatherName: 'Bulk Father',
          motherName: 'Bulk Mother',
          contactNumber: '1234567890'
        },
        monthlyFee: 2500
      });

      // Create fee records for each student
      await Fee.create([
        {
          student: testStudent._id,
          feeType: 'tuition',
          amount: 2500,
          dueDate: new Date(),
          status: 'unpaid',
          recordedBy: testUser._id
        }
      ]);

      testData.push({ user: testUser, student: testStudent });
    }

    // Count fees before bulk deletion
    const studentIds = testData.map(data => data.student._id);
    const feesBeforeDelete = await Fee.countDocuments({ student: { $in: studentIds } });
    console.log('Fees before bulk delete:', feesBeforeDelete);

    // Bulk delete students
    await Student.deleteMany({ _id: { $in: studentIds } });

    // Count fees after bulk deletion
    const feesAfterDelete = await Fee.countDocuments({ student: { $in: studentIds } });
    console.log('Fees after bulk delete:', feesAfterDelete);

    // Clean up test users
    const userIds = testData.map(data => data.user._id);
    await User.deleteMany({ _id: { $in: userIds } });

    if (feesAfterDelete === 0) {
      console.log('✅ deleteMany: SUCCESS - All fees deleted');
    } else {
      console.log(`❌ deleteMany: FAILURE - ${feesAfterDelete} fees remain`);
    }

  } catch (error) {
    console.error('Error testing bulk delete:', error.message);
  }
}

// Run the comprehensive test
testAllDeleteMethods();