const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Student = require('../models/Student');
const User = require('../models/User');

// Load environment variables
dotenv.config();

// Connect to MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${mongoose.connection.host}`);
    return conn;
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

// Seed classes with sample data
const seedClasses = async () => {
  try {
    // Create a sample admin user if it doesn't exist
    const adminExists = await User.findOne({ email: 'admin@school.com' });
    
    let adminUser;
    if (!adminExists) {
      adminUser = await User.create({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@school.com',
        password: 'password123',
        role: 'admin',
        status: 'active',
        isApproved: true,
        isSystemAccount: true
      });
      console.log('Admin user created');
    } else {
      adminUser = adminExists;
      console.log('Admin user already exists');
    }

    // Create sample classes (1-10) with students
    const classes = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    const sections = ['A', 'B', 'C'];

    for (const cls of classes) {
      for (const section of sections) {
        // Create 2 sample students for each class and section
        for (let i = 1; i <= 2; i++) {
          const studentEmail = `student_${cls}_${section}_${i}@school.com`;
          
          // Check if student already exists
          const studentExists = await User.findOne({ email: studentEmail });
          
          if (!studentExists) {
            // Create user
            const user = await User.create({
              firstName: `Student${i}`,
              lastName: `Class${cls}${section}`,
              email: studentEmail,
              password: 'password123',
              role: 'student',
              status: 'active',
              isApproved: true
            });
            
            // Create student profile
            await Student.create({
              user: user._id,
              rollNumber: `${cls}${section}${i.toString().padStart(2, '0')}`,
              dateOfBirth: new Date(2000, 0, 1),
              gender: i % 2 === 0 ? 'male' : 'female',
              class: cls,
              section: section,
              address: {
                street: '123 School St',
                city: 'School City',
                state: 'School State',
                zipCode: '12345',
                country: 'School Country'
              },
              parentInfo: {
                fatherName: `Father of Student${i}`,
                motherName: `Mother of Student${i}`,
                contactNumber: '1234567890',
                email: `parent_${cls}_${section}_${i}@school.com`
              },
              admissionDate: new Date()
            });
            
            console.log(`Created student: ${studentEmail}`);
          } else {
            console.log(`Student already exists: ${studentEmail}`);
          }
        }
      }
    }

    console.log('Sample classes and students created successfully');
  } catch (error) {
    console.error('Error seeding classes:', error);
  }
};

// Run the seeding
connectDB()
  .then(async () => {
    await seedClasses();
    console.log('Seeding completed');
    process.exit();
  })
  .catch((error) => {
    console.error('Error in seeding script:', error);
    process.exit(1);
  });
