const Student = require('../models/Student');
const User = require('../models/User');
const Teacher = require('../models/Teacher');
const Parent = require('../models/Parent');
const { createInitialFeeRecord } = require('./fee.controller');
const { getTenantModel } = require('../middleware/tenant');
const { updateUsage } = require('../middleware/subscriptionLimits');
const SAAS_CONFIG = require('../config/saas');

// @desc    Get all students
// @route   GET /api/students
// @access  Private
exports.getStudents = async (req, res) => {
  try {
    // Get tenant-specific models
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const TenantUser = getTenantModel(req, 'User', User.schema);
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);

    // Build query with tenant filter
    let query;
    const reqQuery = { ...req.query, tenant: req.tenantId };
    const removeFields = ['select', 'sort', 'page', 'limit', 'viewAll', 'search'];
    const viewAll = req.query.viewAll === 'true';
    
    if (viewAll) {
      delete reqQuery.class;
      delete reqQuery.section;
    }

    const searchQuery = req.query.search;
    removeFields.forEach(param => delete reqQuery[param]);

    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    let parsedQuery = JSON.parse(queryStr);

    // For teachers, restrict to their assigned classes
    if (req.user.role === 'teacher') {
      const teacher = await TenantTeacher.findOne({ user: req.user.id, tenant: req.tenantId });
      if (teacher && teacher.classes && teacher.classes.length > 0) {
        const validClasses = teacher.classes.filter(cls => cls !== 'Not assigned');
        if (validClasses.length > 0) {
          parsedQuery.class = { $in: validClasses };
        } else {
          return res.status(200).json({ success: true, count: 0, pagination: {}, data: [] });
        }
      } else {
        return res.status(200).json({ success: true, count: 0, pagination: {}, data: [] });
      }
    }

    // For students, only show their own profile
    if (req.user.role === 'student') {
      parsedQuery.user = req.user.id;
    }

    // Handle search
    if (searchQuery && searchQuery.trim()) {
      const searchRegex = new RegExp(searchQuery.trim(), 'i');
      const allStudentsForSearch = await TenantStudent.find(parsedQuery)
        .populate({ path: 'user', select: 'name email role profileImage isApproved status' })
        .populate('feeRecords');
      
      const searchFilteredStudents = allStudentsForSearch.filter(student => {
        if (!student.user || !student.user.isApproved || student.user.status !== 'active') {
          return false;
        }
        return (
          searchRegex.test(student.rollNumber) ||
          searchRegex.test(student.class) ||
          searchRegex.test(student.section) ||
          searchRegex.test(student.user.name)
        );
      });
      
      const totalCount = searchFilteredStudents.length;
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 25;
      const startIndex = (page - 1) * limit;
      const endIndex = page * limit;
      const paginatedStudents = searchFilteredStudents.slice(startIndex, endIndex);
      
      const pagination = {};
      if (endIndex < totalCount) pagination.next = { page: page + 1, limit };
      if (startIndex > 0) pagination.prev = { page: page - 1, limit };
      
      return res.status(200).json({
        success: true,
        count: paginatedStudents.length,
        totalCount: totalCount,
        pagination,
        data: paginatedStudents
      });
    }
    
    // Regular query
    query = TenantStudent.find(parsedQuery)
      .populate({ path: 'user', select: 'name email role profileImage isApproved status' })
      .populate('feeRecords');

    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Get total count
    const allStudents = await TenantStudent.find(parsedQuery)
      .populate({ path: 'user', select: 'isApproved status' });
    
    const activeStudents = allStudents.filter(student =>
      student.user && student.user.isApproved && student.user.status === 'active'
    );
    const totalCount = activeStudents.length;

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    query = query.skip(startIndex).limit(limit);
    let students = await query;
    
    students = students.filter(student =>
      student.user && student.user.isApproved && student.user.status === 'active'
    );

    const pagination = {};
    if (endIndex < totalCount) pagination.next = { page: page + 1, limit };
    if (startIndex > 0) pagination.prev = { page: page - 1, limit };

    res.status(200).json({
      success: true,
      count: students.length,
      totalCount: totalCount,
      pagination,
      data: students
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Error fetching students' });
  }
};

// @desc    Get single student
// @route   GET /api/students/:id
// @access  Private
exports.getStudent = async (req, res) => {
  try {
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);

    const student = await TenantStudent.findOne({ _id: req.params.id, tenant: req.tenantId })
      .populate({ path: 'user', select: 'name email role profileImage' })
      .populate('attendanceRecords')
      .populate('feeRecords');

    if (!student) {
      return res.status(404).json({ success: false, message: `No student found with id ${req.params.id}` });
    }

    // For teachers, check if they can access this student
    if (req.user.role === 'teacher') {
      const teacher = await TenantTeacher.findOne({ user: req.user.id, tenant: req.tenantId });
      if (teacher && teacher.classes && teacher.classes.length > 0) {
        if (!teacher.classes.includes(student.class)) {
          return res.status(403).json({ success: false, message: 'You are not authorized to view this student' });
        }
      } else {
        return res.status(403).json({ success: false, message: 'No classes assigned to you' });
      }
    }

    // For students, only allow access to their own profile
    if (req.user.role === 'student') {
      if (student.user._id.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You can only view your own profile' });
      }
    }

    res.status(200).json({ success: true, data: student });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Helper function to generate student password in format FirstName@123
const generateStudentPassword = (firstName) => {
  return `${firstName}@123`;
};

// @desc    Create student
// @route   POST /api/students
// @access  Private/Admin
exports.createStudent = async (req, res) => {
  try {
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const TenantUser = getTenantModel(req, 'User', User.schema);
    
    const { userData, studentData } = req.body;

    // Ensure email follows the required format for students
    if (!userData.email || !userData.email.startsWith('std') || !userData.email.includes(`@${req.tenant.subdomain}.${SAAS_CONFIG.SAAS_DOMAIN}`)) {
      userData.email = SAAS_CONFIG.generateEmail('std', userData.firstName, userData.lastName, req.tenant.subdomain);
    }

    // Check if the email already exists in tenant
    const existingUser = await TenantUser.findOne({ email: userData.email, tenant: req.tenantId });
    if (existingUser) {
      let counter = 1;
      let newEmail = userData.email;
      const emailParts = userData.email.split('@');
      const basePart = emailParts[0];
      const domainPart = emailParts[1];

      while (await TenantUser.findOne({ email: newEmail, tenant: req.tenantId })) {
        newEmail = `${basePart}${counter}@${domainPart}`;
        counter++;
      }
      userData.email = newEmail;
    }

    // Generate password if not provided
    if (!userData.password) {
      userData.password = `${userData.firstName}@123`;
    }

    // Create user with tenant reference
    userData.tenant = req.tenantId;
    userData.role = 'student';
    userData.isApproved = true;
    userData.status = 'active';
    userData.approvedBy = req.user.id;
    userData.approvedAt = Date.now();
    const user = await TenantUser.create(userData);

    // Create student with tenant reference
    studentData.tenant = req.tenantId;
    studentData.user = user._id;
    
    if (studentData.admissionDate) {
      studentData.admissionDate = new Date(studentData.admissionDate);
    }
    
    const student = await TenantStudent.create(studentData);

    // Create initial fee record
    if (student && student.monthlyFee > 0) {
      try {
        const feeRecord = await createInitialFeeRecord(student._id, req.user.id, student.monthlyFee);
      } catch (feeError) {
        console.error('Error creating initial fee record:', feeError);
      }
    }

    // Create parent account if email provided
    if (studentData.parentInfo && studentData.parentInfo.email) {
      try {
        const TenantParent = getTenantModel(req, 'Parent', Parent.schema);
        let parentUser = await TenantUser.findOne({ 
          email: studentData.parentInfo.email, 
          tenant: req.tenantId 
        });

        if (!parentUser) {
          parentUser = await TenantUser.create({
            tenant: req.tenantId,
            firstName: studentData.parentInfo.fatherName?.split(' ')[0] || 'Parent',
            lastName: studentData.parentInfo.fatherName?.split(' ').slice(1).join(' ') || '',
            email: studentData.parentInfo.email,
            password: 'Parent@123',
            role: 'parent',
            status: 'active',
            isApproved: true,
            phone: studentData.parentInfo.contactNumber ? { full: studentData.parentInfo.contactNumber } : undefined,
            emailVerification: { isVerified: true, verifiedAt: new Date() }
          });
        }

        let parent = await TenantParent.findOne({ user: parentUser._id, tenant: req.tenantId });
        if (!parent) {
          parent = await TenantParent.create({
            tenant: req.tenantId,
            user: parentUser._id,
            children: [student._id],
            relationship: 'guardian',
            occupation: studentData.parentInfo.occupation
          });
        } else if (!parent.children.includes(student._id)) {
          parent.children.push(student._id);
          await parent.save();
        }
      } catch (parentError) {
        console.error('Error creating parent account:', parentError);
      }
    }

    // Update usage tracking
    await updateUsage(req.tenantId, 'students', 1);

    res.status(201).json({
      success: true,
      data: {
        student,
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private/Admin
exports.updateStudent = async (req, res) => {
  try {
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const TenantUser = getTenantModel(req, 'User', User.schema);
    
    const { userData, studentData } = req.body;
    let updatedData = {};

    const existingStudent = await TenantStudent.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!existingStudent) {
      return res.status(404).json({ success: false, message: `No student found with id ${req.params.id}` });
    }

    // For students, only allow them to update their own profile
    if (req.user.role === 'student') {
      if (existingStudent.user.toString() !== req.user.id) {
        return res.status(403).json({ success: false, message: 'You can only update your own profile' });
      }

      const allowedStudentFields = ['address', 'parentInfo'];
      if (studentData) {
        const filteredStudentData = {};
        allowedStudentFields.forEach(field => {
          if (studentData[field] !== undefined) filteredStudentData[field] = studentData[field];
        });

        if (Object.keys(filteredStudentData).length > 0) {
          const student = await TenantStudent.findOneAndUpdate(
            { _id: req.params.id, tenant: req.tenantId },
            filteredStudentData,
            { new: true, runValidators: true }
          );
          updatedData.student = student;
        }
      }
    } else {
      if (studentData) {
        const student = await TenantStudent.findOneAndUpdate(
          { _id: req.params.id, tenant: req.tenantId },
          studentData,
          { new: true, runValidators: true }
        );
        updatedData.student = student;
      }
    }

    // Update user data if provided
    if (userData) {
      const student = await TenantStudent.findOne({ _id: req.params.id, tenant: req.tenantId });
      if (!student) {
        return res.status(404).json({ success: false, message: `No student found with id ${req.params.id}` });
      }

      let userUpdateData = userData;
      if (req.user.role === 'student') {
        const allowedUserFields = ['firstName', 'middleName', 'lastName', 'name', 'profileImage'];
        userUpdateData = {};
        allowedUserFields.forEach(field => {
          if (userData[field] !== undefined) userUpdateData[field] = userData[field];
        });
      }

      if (Object.keys(userUpdateData).length > 0) {
        const user = await TenantUser.findOneAndUpdate(
          { _id: student.user, tenant: req.tenantId },
          userUpdateData,
          { new: true, runValidators: true }
        );
        updatedData.user = user;
      }
    }

    res.status(200).json({ success: true, data: updatedData });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private/Admin
exports.deleteStudent = async (req, res) => {
  try {
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const TenantUser = getTenantModel(req, 'User', User.schema);

    const student = await TenantStudent.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!student) {
      return res.status(404).json({ success: false, message: `No student found with id ${req.params.id}` });
    }

    const userId = student.user;
    await student.deleteOne();
    await TenantUser.findOneAndDelete({ _id: userId, tenant: req.tenantId });

    // Update usage tracking
    await updateUsage(req.tenantId, 'students', -1);

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
