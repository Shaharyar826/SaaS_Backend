const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

// Import models
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const AdminStaff = require('../models/AdminStaff');
const SupportStaff = require('../models/SupportStaff');
const UploadHistory = require('../models/UploadHistory');

// Import fee controller for creating initial fee records
const { createInitialFeeRecord } = require('./fee.controller');

// Helper function to validate email format
const isValidEmail = (email) => {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  return emailRegex.test(email);
};

// Helper function to generate a secure password
const generatePassword = () => {
  return Math.random().toString(36).slice(-8);
};

// Helper function to create upload history record
const createUploadHistory = async (userType, file, userId, status, totalRecords, successCount, errorCount, errors) => {
  try {
    return await UploadHistory.create({
      userType,
      filename: file.filename,
      originalFilename: file.originalname,
      uploadedBy: userId,
      status,
      totalRecords,
      successCount,
      errorCount,
      errors
    });
  } catch (err) {
    console.error('Error creating upload history:', err);
    throw err;
  }
};

// Helper function to parse Excel/CSV file
const parseFile = async (filePath) => {
  try {
    console.log(`Attempting to parse file: ${filePath}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`File does not exist: ${filePath}`);
      throw new Error('File not found. The uploaded file may have been deleted.');
    }

    // Determine file type based on extension
    const fileExtension = path.extname(filePath).toLowerCase();
    console.log(`File extension: ${fileExtension}`);

    let rawData = [];

    if (fileExtension === '.csv') {
      // Handle CSV file
      console.log('Parsing CSV file');
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const lines = fileContent.split(/\r?\n/);

      // Process each line
      for (const line of lines) {
        if (line.trim() === '') continue; // Skip empty lines

        // Split by comma, handling quoted values
        const row = [];
        let inQuotes = false;
        let currentValue = '';

        for (let i = 0; i < line.length; i++) {
          const char = line[i];

          if (char === '"' && (i === 0 || line[i-1] !== '\\')) {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            row.push(currentValue);
            currentValue = '';
          } else {
            currentValue += char;
          }
        }

        // Add the last value
        row.push(currentValue);

        // Remove quotes from values
        const cleanedRow = row.map(value => {
          if (value.startsWith('"') && value.endsWith('"')) {
            return value.substring(1, value.length - 1);
          }
          return value;
        });

        rawData.push(cleanedRow);
      }
    } else {
      // Handle Excel file
      console.log('Parsing Excel file');
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      // Check if workbook has sheets
      if (!workbook.worksheets || workbook.worksheets.length === 0) {
        console.error('Workbook has no sheets');
        throw new Error('The uploaded Excel file has no sheets.');
      }

      // Get the first worksheet
      const worksheet = workbook.worksheets[0];

      // Check if worksheet has data
      if (!worksheet || worksheet.rowCount < 2) {
        console.error('Worksheet is empty or invalid');
        throw new Error('The uploaded Excel file contains an empty or invalid worksheet.');
      }

      // Get all rows as array
      worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
        const rowData = [];
        row.eachCell({ includeEmpty: true }, (cell) => {
          rowData.push(cell.value !== null ? cell.value : '');
        });
        rawData.push(rowData);
      });
    }

    if (rawData.length < 2) {
      console.error('Not enough data rows in the file');
      throw new Error('The uploaded file must contain a header row and at least one data row.');
    }

    // Extract and clean headers
    const headers = rawData[0].map(header => {
      if (!header) return '';

      // Convert to string and handle rich text objects
      const headerText = header.richText ?
        header.richText.map(rt => rt.text).join('') :
        header.toString();

      // Extract the base field name by removing any text in parentheses
      const match = headerText.match(/^([^(]+)/);
      return match ? match[1].trim() : headerText.trim();
    });

    // Check for empty headers
    const emptyHeaderIndices = headers.map((h, i) => h === '' ? i : -1).filter(i => i !== -1);
    if (emptyHeaderIndices.length > 0) {
      console.error('Empty headers found at indices:', emptyHeaderIndices);
      throw new Error(`Empty column headers found. Please ensure all columns have headers.`);
    }

    // Create data objects with cleaned headers
    const data = [];
    for (let i = 1; i < rawData.length; i++) {
      const row = rawData[i];
      const obj = {};
      let isEmpty = true;

      headers.forEach((header, index) => {
        if (header && index < row.length) {
          const value = row[index] !== undefined ? row[index] : '';
          obj[header] = value;

          // Check if this is a real data value (not empty and not an instruction)
          const valueStr = String(value);
          if (value !== '' &&
              !valueStr.toUpperCase().includes('IMPORTANT') &&
              !valueStr.toUpperCase().includes('NOTE') &&
              !valueStr.toUpperCase().includes('INSTRUCTION')) {
            isEmpty = false;
          }
        }
      });

      // Only add non-empty rows that don't look like instructions
      if (!isEmpty) {
        // Check if this row has enough required fields to be a valid data row
        const requiredFieldCount = Object.keys(obj).filter(key =>
          obj[key] !== '' &&
          ['firstName', 'lastName', 'email'].includes(key)
        ).length;

        // Only add rows that have at least some key required fields
        if (requiredFieldCount > 0) {
          console.log(`Adding data row ${i+1}:`, obj);
          data.push(obj);
        } else {
          console.log(`Skipping row ${i+1} - appears to be instructions or has no key fields`);
        }
      } else {
        console.log(`Skipping empty row ${i+1}`);
      }
    }

    console.log(`Successfully parsed file. Found ${data.length} records with headers:`, headers);
    return data;
  } catch (err) {
    console.error('Error parsing file:', err);
    if (err.message.includes('Unsupported file')) {
      throw new Error('Unsupported file format. Please upload a valid Excel (.xlsx, .xls) or CSV file.');
    }
    throw new Error(`Error parsing file: ${err.message}. Please check the file format.`);
  }
};

// @desc    Upload students from Excel/CSV
// @route   POST /api/upload/students
// @access  Private/Admin
exports.uploadStudents = async (req, res) => {
  console.log('Upload students endpoint called');

  if (!req.file) {
    console.error('No file uploaded');
    return res.status(400).json({
      success: false,
      message: 'Please upload a file'
    });
  }

  console.log('File uploaded:', req.file);
  const filePath = req.file.path;
  const errors = [];
  let successCount = 0;
  let errorCount = 0;
  let students = [];
  let totalRecords = 0;

  try {
    // Note: No longer creating uploads directory as we use Cloudinary for all file storage

    // Parse the Excel/CSV file
    console.log('Parsing file:', filePath);
    try {
      students = await parseFile(filePath);
      totalRecords = students.length;
      console.log(`Parsed ${totalRecords} records from file`);
    } catch (parseError) {
      console.error('Error parsing file:', parseError);
      return res.status(400).json({
        success: false,
        message: parseError.message || 'Error parsing file. Please check the file format.'
      });
    }

    if (totalRecords === 0) {
      console.error('No records found in file');
      return res.status(400).json({
        success: false,
        message: 'The uploaded file contains no data'
      });
    }

    // Process each student
    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      const rowNum = i + 2; // +2 because Excel is 1-indexed and we have a header row

      try {
        // Validate required fields (email is not required as it will be auto-generated)
        const requiredFields = [
          'firstName', 'lastName', 'rollNumber',
          'class', 'section', 'gender', 'monthlyFee',
          'fatherName', 'motherName', 'contactNumber'
        ];

        const missingFields = [];

        for (const field of requiredFields) {
          if (!student[field]) {
            missingFields.push(field);
          }
        }

        if (missingFields.length > 0) {
          console.log(`Row ${rowNum} missing fields:`, missingFields);
          throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
        }

        // Auto-generate email if not provided or if it doesn't follow the student format
        if (!student.email || !student.email.startsWith('std') || !student.email.endsWith('@schoolms.com')) {
          // Generate student email
          const cleanFirstName = student.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
          const cleanLastName = student.lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
          let generatedEmail = `std${cleanFirstName}${cleanLastName}@schoolms.com`;

          // Check if the email already exists
          const existingUser = await User.findOne({ email: generatedEmail });
          if (existingUser) {
            // If email exists, modify it to make it unique by adding a number
            let counter = 1;
            let newEmail = generatedEmail;

            // Extract the base part of the email (before @)
            const emailParts = generatedEmail.split('@');
            const basePart = emailParts[0];
            const domainPart = emailParts[1];

            // Try adding numbers until we find a unique email
            while (await User.findOne({ email: newEmail })) {
              newEmail = `${basePart}${counter}@${domainPart}`;
              counter++;
            }

            generatedEmail = newEmail;
          }

          // Override the provided email with the generated one
          student.email = generatedEmail;
        } else {
          // Validate email format if provided
          if (!isValidEmail(student.email)) {
            throw new Error('Invalid email format');
          }

          // Check if email already exists
          const existingUser = await User.findOne({ email: student.email });
          if (existingUser) {
            throw new Error('Email already exists');
          }
        }

        // Check if roll number already exists
        const existingStudent = await Student.findOne({ rollNumber: student.rollNumber });
        if (existingStudent) {
          throw new Error('Roll number already exists');
        }

        // Create user
        const password = generatePassword();
        const userData = {
          firstName: student.firstName,
          middleName: student.middleName || '',
          lastName: student.lastName,
          email: student.email,
          password,
          role: 'student',
          isApproved: true,
          status: 'active',
          approvedBy: req.user.id,
          approvedAt: Date.now()
        };

        const user = await User.create(userData);

        // Create student profile
        const studentData = {
          user: user._id,
          rollNumber: student.rollNumber,
          dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth) : new Date(),
          gender: student.gender.toLowerCase(),
          class: student.class,
          section: student.section,
          monthlyFee: parseFloat(student.monthlyFee) || 0,
          address: {
            street: student.street || '',
            city: student.city || '',
            state: student.state || '',
            zipCode: student.zipCode || '',
            country: student.country || ''
          },
          parentInfo: {
            fatherName: student.fatherName,
            motherName: student.motherName,
            guardianName: student.guardianName || '',
            contactNumber: student.contactNumber,
            email: student.parentEmail || '',
            occupation: student.occupation || ''
          },
          admissionDate: student.admissionDate ? new Date(student.admissionDate) : new Date()
        };

        // Create the student record
        const createdStudent = await Student.create(studentData);

        // Create initial fee record for the student if monthly fee is set
        if (createdStudent && createdStudent.monthlyFee > 0) {
          try {
            const feeRecord = await createInitialFeeRecord(
              createdStudent._id,
              req.user.id,
              createdStudent.monthlyFee
            );
            console.log(`Created initial fee record for student ${createdStudent._id} from bulk upload`);
          } catch (feeError) {
            console.error(`Error creating initial fee record for student ${createdStudent._id}:`, feeError);
            // Don't fail the student creation if fee record creation fails
          }
        } else {
          console.log(`Skipping initial fee record creation for student ${createdStudent._id} - no monthly fee set`);
        }

        successCount++;
      } catch (err) {
        errorCount++;
        errors.push({
          row: rowNum,
          message: err.message
        });
      }
    }

    // Create upload history
    const status = errorCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed');
    await createUploadHistory('student', req.file, req.user.id, status, totalRecords, successCount, errorCount, errors);

    // Return response
    res.status(200).json({
      success: true,
      message: `Processed ${totalRecords} records. Success: ${successCount}, Failed: ${errorCount}`,
      data: {
        totalRecords,
        successCount,
        errorCount,
        errors
      }
    });
  } catch (err) {
    console.error('Error processing file:', err);

    // Determine the appropriate status code and message
    let statusCode = 500;
    let errorMessage = 'Error processing file';

    if (err.message.includes('duplicate key') || err.message.includes('already exists')) {
      statusCode = 400;
      errorMessage = 'Duplicate entries found. Email or roll number may already exist.';
    } else if (err.message.includes('validation failed')) {
      statusCode = 400;
      errorMessage = 'Validation failed. Please check your data format.';
    } else if (err.message.includes('required')) {
      statusCode = 400;
      errorMessage = 'Missing required fields in the uploaded file.';
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: err.message
    });
  } finally {
    try {
      // Clean up the uploaded file
      if (fs.existsSync(filePath)) {
        console.log(`Deleting temporary file: ${filePath}`);
        fs.unlinkSync(filePath);
      }
    } catch (unlinkErr) {
      console.error('Error deleting file:', unlinkErr);
    }
  }
};

// @desc    Upload teachers from Excel/CSV
// @route   POST /api/upload/teachers
// @access  Private/Admin
exports.uploadTeachers = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Please upload a file'
    });
  }

  const filePath = req.file.path;
  const errors = [];
  let successCount = 0;
  let errorCount = 0;

  try {
    // Parse the Excel/CSV file
    const teachers = await parseFile(filePath);
    const totalRecords = teachers.length;

    if (totalRecords === 0) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded file contains no data'
      });
    }

    // Process each teacher
    for (let i = 0; i < teachers.length; i++) {
      const teacher = teachers[i];
      const rowNum = i + 2; // +2 because Excel is 1-indexed and we have a header row

      try {
        // Validate required fields
        if (!teacher.firstName || !teacher.lastName ||
            !teacher.phoneNumber || !teacher.qualification || !teacher.experience ||
            !teacher.subjects || !teacher.gender || !teacher.salary) {
          throw new Error('Missing required fields');
        }

        // Generate teacher email in the required format
        const cleanFirstName = teacher.firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cleanLastName = teacher.lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
        let generatedEmail = `tch${cleanFirstName}${cleanLastName}@schoolms.com`;

        // Check if the email already exists
        const existingUser = await User.findOne({ email: generatedEmail });
        if (existingUser) {
          // If email exists, modify it to make it unique by adding a number
          let counter = 1;
          let newEmail = generatedEmail;

          // Extract the base part of the email (before @)
          const emailParts = generatedEmail.split('@');
          const basePart = emailParts[0];
          const domainPart = emailParts[1];

          // Try adding numbers until we find a unique email
          while (await User.findOne({ email: newEmail })) {
            newEmail = `${basePart}${counter}@${domainPart}`;
            counter++;
          }

          generatedEmail = newEmail;
        }

        // Set the generated email
        teacher.email = generatedEmail;

        // Generate a unique employee ID - no need to check if it exists since we're generating it
        const teacherCount = await Teacher.countDocuments();
        const currentYear = new Date().getFullYear().toString().substr(-2); // Get last 2 digits of year
        const employeeId = `TCH${currentYear}${(teacherCount + 1).toString().padStart(4, '0')}`;
        teacher.employeeId = employeeId;

        // Create user
        const password = generatePassword();
        const userData = {
          firstName: teacher.firstName,
          middleName: teacher.middleName || '',
          lastName: teacher.lastName,
          email: teacher.email,
          password,
          role: 'teacher',
          isApproved: true,
          status: 'active',
          approvedBy: req.user.id,
          approvedAt: Date.now()
        };

        const user = await User.create(userData);

        // Parse subjects and classes
        const subjects = Array.isArray(teacher.subjects)
          ? teacher.subjects
          : teacher.subjects.split(',').map(s => s.trim());

        const classes = teacher.classes
          ? (Array.isArray(teacher.classes)
            ? teacher.classes
            : teacher.classes.split(',').map(c => c.trim()))
          : [];

        // Create teacher profile
        const teacherData = {
          user: user._id,
          employeeId: teacher.employeeId,
          dateOfBirth: teacher.dateOfBirth ? new Date(teacher.dateOfBirth) : new Date(),
          gender: teacher.gender.toLowerCase(),
          phoneNumber: teacher.phoneNumber,
          qualification: teacher.qualification,
          experience: parseInt(teacher.experience),
          subjects,
          classes,
          salary: parseFloat(teacher.salary),
          address: {
            street: teacher.street || '',
            city: teacher.city || '',
            state: teacher.state || '',
            zipCode: teacher.zipCode || '',
            country: teacher.country || ''
          },
          joiningDate: teacher.joiningDate ? new Date(teacher.joiningDate) : new Date()
        };

        await Teacher.create(teacherData);
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push({
          row: rowNum,
          message: err.message
        });
      }
    }

    // Create upload history
    const status = errorCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed');
    await createUploadHistory('teacher', req.file, req.user.id, status, totalRecords, successCount, errorCount, errors);

    // Return response
    res.status(200).json({
      success: true,
      message: `Processed ${totalRecords} records. Success: ${successCount}, Failed: ${errorCount}`,
      data: {
        totalRecords,
        successCount,
        errorCount,
        errors
      }
    });
  } catch (err) {
    console.error('Error processing file:', err);
    res.status(500).json({
      success: false,
      message: 'Error processing file',
      error: err.message
    });
  } finally {
    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
  }
};

// @desc    Upload admin staff from Excel/CSV
// @route   POST /api/upload/admin-staff
// @access  Private/Admin
exports.uploadAdminStaff = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Please upload a file'
    });
  }

  const filePath = req.file.path;
  const errors = [];
  let successCount = 0;
  let errorCount = 0;

  try {
    // Parse the Excel/CSV file
    const adminStaffList = parseFile(filePath);
    const totalRecords = adminStaffList.length;

    if (totalRecords === 0) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded file contains no data'
      });
    }

    // Process each admin staff
    for (let i = 0; i < adminStaffList.length; i++) {
      const staff = adminStaffList[i];
      const rowNum = i + 2; // +2 because Excel is 1-indexed and we have a header row

      try {
        // Validate required fields
        if (!staff.firstName || !staff.lastName || !staff.email || !staff.employeeId ||
            !staff.phoneNumber || !staff.qualification || !staff.experience ||
            !staff.position || !staff.department || !staff.gender || !staff.salary) {
          throw new Error('Missing required fields');
        }

        // Validate email format
        if (!isValidEmail(staff.email)) {
          throw new Error('Invalid email format');
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: staff.email });
        if (existingUser) {
          throw new Error('Email already exists');
        }

        // Check if employee ID already exists
        const existingStaff = await AdminStaff.findOne({ employeeId: staff.employeeId });
        if (existingStaff) {
          throw new Error('Employee ID already exists');
        }

        // Create user
        const password = generatePassword();
        const userData = {
          firstName: staff.firstName,
          middleName: staff.middleName || '',
          lastName: staff.lastName,
          email: staff.email,
          password,
          role: staff.role || 'admin',
          isApproved: true,
          status: 'active',
          approvedBy: req.user.id,
          approvedAt: Date.now()
        };

        const user = await User.create(userData);

        // Parse responsibilities
        const responsibilities = staff.responsibilities
          ? (Array.isArray(staff.responsibilities)
            ? staff.responsibilities
            : staff.responsibilities.split(',').map(r => r.trim()))
          : [];

        // Create admin staff profile
        const adminStaffData = {
          user: user._id,
          employeeId: staff.employeeId,
          dateOfBirth: staff.dateOfBirth ? new Date(staff.dateOfBirth) : new Date(),
          gender: staff.gender.toLowerCase(),
          phoneNumber: staff.phoneNumber,
          qualification: staff.qualification,
          experience: parseInt(staff.experience),
          position: staff.position,
          department: staff.department,
          salary: parseFloat(staff.salary),
          responsibilities,
          address: {
            street: staff.street || '',
            city: staff.city || '',
            state: staff.state || '',
            zipCode: staff.zipCode || '',
            country: staff.country || ''
          },
          joiningDate: staff.joiningDate ? new Date(staff.joiningDate) : new Date()
        };

        await AdminStaff.create(adminStaffData);
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push({
          row: rowNum,
          message: err.message
        });
      }
    }

    // Create upload history
    const status = errorCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed');
    await createUploadHistory('admin-staff', req.file, req.user.id, status, totalRecords, successCount, errorCount, errors);

    // Return response
    res.status(200).json({
      success: true,
      message: `Processed ${totalRecords} records. Success: ${successCount}, Failed: ${errorCount}`,
      data: {
        totalRecords,
        successCount,
        errorCount,
        errors
      }
    });
  } catch (err) {
    console.error('Error processing file:', err);
    res.status(500).json({
      success: false,
      message: 'Error processing file',
      error: err.message
    });
  } finally {
    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
  }
};

// @desc    Upload support staff from Excel/CSV
// @route   POST /api/upload/support-staff
// @access  Private/Admin
exports.uploadSupportStaff = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'Please upload a file'
    });
  }

  const filePath = req.file.path;
  const errors = [];
  let successCount = 0;
  let errorCount = 0;

  try {
    // Parse the Excel/CSV file
    const supportStaffList = parseFile(filePath);
    const totalRecords = supportStaffList.length;

    if (totalRecords === 0) {
      return res.status(400).json({
        success: false,
        message: 'The uploaded file contains no data'
      });
    }

    // Process each support staff
    for (let i = 0; i < supportStaffList.length; i++) {
      const staff = supportStaffList[i];
      const rowNum = i + 2; // +2 because Excel is 1-indexed and we have a header row

      try {
        // Validate required fields
        if (!staff.firstName || !staff.lastName || !staff.email || !staff.employeeId ||
            !staff.phoneNumber || !staff.position || !staff.experience ||
            !staff.gender || !staff.salary) {
          throw new Error('Missing required fields');
        }

        // Validate email format
        if (!isValidEmail(staff.email)) {
          throw new Error('Invalid email format');
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: staff.email });
        if (existingUser) {
          throw new Error('Email already exists');
        }

        // Check if employee ID already exists
        const existingStaff = await SupportStaff.findOne({ employeeId: staff.employeeId });
        if (existingStaff) {
          throw new Error('Employee ID already exists');
        }

        // Create user
        const password = generatePassword();
        const userData = {
          firstName: staff.firstName,
          middleName: staff.middleName || '',
          lastName: staff.lastName,
          email: staff.email,
          password,
          role: 'support-staff',
          isApproved: true,
          status: 'active',
          approvedBy: req.user.id,
          approvedAt: Date.now()
        };

        const user = await User.create(userData);

        // Parse working hours
        const daysOfWeek = staff.daysOfWeek
          ? (Array.isArray(staff.daysOfWeek)
            ? staff.daysOfWeek
            : staff.daysOfWeek.split(',').map(d => d.trim()))
          : [];

        // Create support staff profile
        const supportStaffData = {
          user: user._id,
          employeeId: staff.employeeId,
          dateOfBirth: staff.dateOfBirth ? new Date(staff.dateOfBirth) : new Date(),
          gender: staff.gender.toLowerCase(),
          position: staff.position.toLowerCase(),
          phoneNumber: staff.phoneNumber,
          experience: parseInt(staff.experience),
          salary: parseFloat(staff.salary),
          workingHours: {
            startTime: staff.startTime || '',
            endTime: staff.endTime || '',
            daysOfWeek
          },
          emergencyContact: {
            name: staff.emergencyName || '',
            relationship: staff.emergencyRelationship || '',
            phoneNumber: staff.emergencyPhone || ''
          },
          address: {
            street: staff.street || '',
            city: staff.city || '',
            state: staff.state || '',
            zipCode: staff.zipCode || '',
            country: staff.country || ''
          },
          joiningDate: staff.joiningDate ? new Date(staff.joiningDate) : new Date()
        };

        await SupportStaff.create(supportStaffData);
        successCount++;
      } catch (err) {
        errorCount++;
        errors.push({
          row: rowNum,
          message: err.message
        });
      }
    }

    // Create upload history
    const status = errorCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed');
    await createUploadHistory('support-staff', req.file, req.user.id, status, totalRecords, successCount, errorCount, errors);

    // Return response
    res.status(200).json({
      success: true,
      message: `Processed ${totalRecords} records. Success: ${successCount}, Failed: ${errorCount}`,
      data: {
        totalRecords,
        successCount,
        errorCount,
        errors
      }
    });
  } catch (err) {
    console.error('Error processing file:', err);
    res.status(500).json({
      success: false,
      message: 'Error processing file',
      error: err.message
    });
  } finally {
    // Clean up the uploaded file
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting file:', err);
    });
  }
};

// @desc    Get upload history
// @route   GET /api/upload/history
// @access  Private/Admin
exports.getUploadHistory = async (req, res) => {
  try {
    const history = await UploadHistory.find()
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'name');

    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving upload history',
      error: err.message
    });
  }
};

// Helper function to send Excel file with proper headers
const sendExcelFile = async (req, res, filePath, fileName) => {
  try {
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      // If file doesn't exist, generate it
      const { generateAllTemplates } = require('../utils/excelTemplates');
      await generateAllTemplates();

      // Check again after generation
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: 'Template file not found. Please try again later.'
        });
      }
    }

    // Set appropriate headers
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Transfer-Encoding', 'binary');
    res.setHeader('Cache-Control', 'no-cache');

    // Send the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.on('error', (err) => {
      console.error('Error reading file stream:', err);
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Error reading template file',
          error: err.message
        });
      }
    });

    fileStream.pipe(res);
  } catch (err) {
    console.error('Error sending template file:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error sending template file',
        error: err.message
      });
    }
  }
};

// @desc    Generate template for student upload
// @route   GET /api/upload/template/student
// @access  Private/Admin
exports.getStudentTemplate = async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../templates/student-template.xlsx');
    await sendExcelFile(req, res, templatePath, 'student-template.xlsx');
  } catch (err) {
    console.error('Error in getStudentTemplate:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error generating student template',
        error: err.message
      });
    }
  }
};

// @desc    Generate template for teacher upload
// @route   GET /api/upload/template/teacher
// @access  Private/Admin
exports.getTeacherTemplate = async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../templates/teacher-template.xlsx');
    await sendExcelFile(req, res, templatePath, 'teacher-template.xlsx');
  } catch (err) {
    console.error('Error in getTeacherTemplate:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error generating teacher template',
        error: err.message
      });
    }
  }
};

// @desc    Generate template for admin staff upload
// @route   GET /api/upload/template/admin-staff
// @access  Private/Admin
exports.getAdminStaffTemplate = async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../templates/admin-staff-template.xlsx');
    await sendExcelFile(req, res, templatePath, 'admin-staff-template.xlsx');
  } catch (err) {
    console.error('Error in getAdminStaffTemplate:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error generating admin staff template',
        error: err.message
      });
    }
  }
};

// @desc    Generate template for support staff upload
// @route   GET /api/upload/template/support-staff
// @access  Private/Admin
exports.getSupportStaffTemplate = async (req, res) => {
  try {
    const templatePath = path.join(__dirname, '../templates/support-staff-template.xlsx');
    await sendExcelFile(req, res, templatePath, 'support-staff-template.xlsx');
  } catch (err) {
    console.error('Error in getSupportStaffTemplate:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Error generating support staff template',
        error: err.message
      });
    }
  }
};
