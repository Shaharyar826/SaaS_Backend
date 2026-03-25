const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();


const User = require('../models/User');
const Student = require('../models/Student');

const createTestStudent = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check if test student already exists
    const existingUser = await User.findOne({ email: 'student.test@schoolms.com' });
    if (existingUser) {
      console.log('Test student already exists with email: student.test@schoolms.com');
      
      // Find the student profile
      const student = await Student.findOne({ user: existingUser._id });
      if (student) {
        console.log('Student details:');
        console.log('Name:', existingUser.name);
        console.log('Email:', existingUser.email);
        console.log('Roll Number:', student.rollNumber);
        console.log('Class:', student.class);
        console.log('Section:', student.section);
        console.log('Password: password123 (default)');
      }
      
      mongoose.disconnect();
      return;
    }

    // Create test user
    const userData = {
      firstName: 'John',
      middleName: 'Michael',
      lastName: 'Doe',
      name: 'John Michael Doe',
      email: 'student.test@schoolms.com',
      password: 'password123',
      role: 'student',
      isApproved: true,
      status: 'active',
      profileImage: {
        url: 'https://via.placeholder.com/150',
        metadata: {
          folder: 'profile',
          format: 'jpg',
          resourceType: 'image',
          publicId: 'test_student_profile',
          createdAt: new Date()
        }
      }
    };

    const user = await User.create(userData);
    console.log('Created test user:', user.email);

    // Create student profile
    const studentData = {
      user: user._id,
      rollNumber: 'STU001',
      dateOfBirth: new Date('2005-01-15'),
      gender: 'male',
      class: '10',
      section: 'A',
      address: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Test Country'
      },
      parentInfo: {
        fatherName: 'Robert Doe',
        motherName: 'Jane Doe',
        contactNumber: '+1234567890',
        email: 'parent.test@schoolms.com',
        occupation: 'Engineer'
      },
      monthlyFee: 5000,
      isActive: true
    };

    const student = await Student.create(studentData);
    console.log('Created test student profile');

    console.log('\n=== TEST STUDENT CREATED ===');
    console.log('Email: student.test@schoolms.com');
    console.log('Password: password123');
    console.log('Name:', user.name);
    console.log('Roll Number:', student.rollNumber);
    console.log('Class:', student.class, 'Section:', student.section);
    console.log('Monthly Fee: ₹', student.monthlyFee);
    console.log('\nYou can now log in with these credentials to test the student portal!');

    mongoose.disconnect();
  } catch (error) {
    console.error('Error creating test student:', error);
    mongoose.disconnect();
    process.exit(1);
  }
};

createTestStudent();
