const Teacher = require('../models/Teacher');
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const { getTenantModel } = require('../middleware/tenant');
const SAAS_CONFIG = require('../config/saas');

// @desc    Get all teachers
// @route   GET /api/teachers
// @access  Private
exports.getTeachers = async (req, res) => {
  try {
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
    let teachers;

    // If user is a teacher, only return their own profile
    if (req.user.role === 'teacher') {
      teachers = await TenantTeacher.find({ user: req.user.id, tenant: req.tenantId })
        .populate({ path: 'user', select: 'name email role profileImage isApproved status' });
    } else {
      teachers = await TenantTeacher.find({ tenant: req.tenantId })
        .populate({ path: 'user', select: 'name email role profileImage isApproved status' });

      // Filter out teachers whose users are not approved or inactive
      teachers = teachers.filter(teacher =>
        teacher.user && teacher.user.isApproved && teacher.user.status === 'active'
      );
    }

    res.status(200).json({ success: true, count: teachers.length, data: teachers });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Get single teacher
// @route   GET /api/teachers/:id
// @access  Private
exports.getTeacher = async (req, res) => {
  try {
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);

    const teacher = await TenantTeacher.findOne({ _id: req.params.id, tenant: req.tenantId })
      .populate({ path: 'user', select: 'name email role profileImage' })
      .populate('attendanceRecords')
      .populate('salaryRecords');

    if (!teacher) {
      return res.status(404).json({ success: false, message: `No teacher found with id ${req.params.id}` });
    }

    // If user is a teacher, they can only view their own profile
    if (req.user.role === 'teacher' && teacher.user._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to access this teacher profile' });
    }

    res.status(200).json({ success: true, data: teacher });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Get logged in teacher profile
// @route   GET /api/teachers/profile
// @access  Private/Teacher
exports.getTeacherProfile = async (req, res) => {
  try {
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);

    if (req.user.role !== 'teacher') {
      return res.status(403).json({ success: false, message: 'Only teachers can access this endpoint' });
    }

    let teacher = await TenantTeacher.findOne({ user: req.user.id, tenant: req.tenantId })
      .populate({ path: 'user', select: 'name email role profileImage' })
      .populate('attendanceRecords')
      .populate('salaryRecords');

    // If no teacher profile exists, create a default one
    if (!teacher) {
      try {
        const teacherCount = await TenantTeacher.countDocuments({ tenant: req.tenantId });
        const currentYear = new Date().getFullYear().toString().substr(-2);
        const employeeId = `TCH${currentYear}${(teacherCount + 1).toString().padStart(4, '0')}`;

        const defaultTeacher = {
          tenant: req.tenantId,
          user: req.user.id,
          employeeId,
          dateOfBirth: new Date(),
          gender: 'other',
          phoneNumber: 'Not provided',
          qualification: 'Not provided',
          experience: 0,
          subjects: ['Not assigned'],
          classes: ['Not assigned'],
          salary: 0,
          isActive: true,
          address: { street: '', city: '', state: '', zipCode: '', country: '' }
        };

        teacher = await TenantTeacher.create(defaultTeacher);
        teacher = await TenantTeacher.findById(teacher._id)
          .populate({ path: 'user', select: 'name email role profileImage' });
      } catch (createErr) {
        return res.status(500).json({ success: false, message: 'Failed to create teacher profile. Please contact an administrator.' });
      }
    }

    res.status(200).json({ success: true, data: teacher });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Create teacher
// @route   POST /api/teachers
// @access  Private/Admin
exports.createTeacher = async (req, res) => {
  try {
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
    const TenantUser = getTenantModel(req, 'User', User.schema);
    
    const { userData, teacherData } = req.body;

    // Ensure email follows the required format for teachers
    if (!userData.email || !userData.email.startsWith('tch') || !userData.email.includes(`@${req.tenant.subdomain}.${SAAS_CONFIG.SAAS_DOMAIN}`)) {
      userData.email = SAAS_CONFIG.generateEmail('tch', userData.firstName, userData.lastName, req.tenant.subdomain);
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

    // Create user with tenant reference
    userData.tenant = req.tenantId;
    userData.role = 'teacher';
    userData.isApproved = true;
    userData.status = 'active';
    userData.approvedBy = req.user.id;
    userData.approvedAt = Date.now();
    const user = await TenantUser.create(userData);

    // Generate unique employee ID for tenant
    const teacherCount = await TenantTeacher.countDocuments({ tenant: req.tenantId });
    const currentYear = new Date().getFullYear().toString().substr(-2);
    const employeeId = `TCH${currentYear}${(teacherCount + 1).toString().padStart(4, '0')}`;

    // Create teacher with tenant reference
    teacherData.tenant = req.tenantId;
    teacherData.user = user._id;
    teacherData.employeeId = employeeId;
    const teacher = await TenantTeacher.create(teacherData);

    res.status(201).json({
      success: true,
      data: {
        teacher,
        user: { id: user._id, name: user.name, email: user.email, role: user.role }
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Update teacher
// @route   PUT /api/teachers/:id
// @access  Private/Admin
exports.updateTeacher = async (req, res) => {
  try {
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
    const TenantUser = getTenantModel(req, 'User', User.schema);
    
    const { userData, teacherData } = req.body;
    let updatedData = {};

    // Check if trying to update employeeId
    if (teacherData && teacherData.employeeId) {
      const existingTeacher = await TenantTeacher.findOne({ _id: req.params.id, tenant: req.tenantId });
      if (existingTeacher && teacherData.employeeId !== existingTeacher.employeeId) {
        return res.status(400).json({ success: false, message: 'Employee ID cannot be modified' });
      }
    }

    // Update teacher data if provided
    if (teacherData) {
      const { employeeId, ...teacherUpdateData } = teacherData;
      const teacher = await TenantTeacher.findOneAndUpdate(
        { _id: req.params.id, tenant: req.tenantId },
        teacherUpdateData,
        { new: true, runValidators: true }
      );

      if (!teacher) {
        return res.status(404).json({ success: false, message: `No teacher found with id ${req.params.id}` });
      }
      updatedData.teacher = teacher;
    }

    // Update user data if provided
    if (userData) {
      const teacher = await TenantTeacher.findOne({ _id: req.params.id, tenant: req.tenantId });
      if (!teacher) {
        return res.status(404).json({ success: false, message: `No teacher found with id ${req.params.id}` });
      }

      const user = await TenantUser.findOneAndUpdate(
        { _id: teacher.user, tenant: req.tenantId },
        userData,
        { new: true, runValidators: true }
      );
      updatedData.user = user;
    }

    res.status(200).json({ success: true, data: updatedData });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Update own teacher profile
// @route   PUT /api/teachers/profile
// @access  Private/Teacher
exports.updateOwnProfile = async (req, res) => {
  try {
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
    const TenantUser = getTenantModel(req, 'User', User.schema);
    
    const { userData, teacherData } = req.body;
    let updatedData = {};

    const teacher = await TenantTeacher.findOne({ user: req.user.id, tenant: req.tenantId });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'No teacher profile found for this user' });
    }

    // Update teacher data if provided
    if (teacherData) {
      const allowedFields = ['phoneNumber', 'qualification', 'subjects', 'classes', 'experience', 'dateOfBirth', 'gender', 'address'];
      const filteredTeacherData = {};

      Object.keys(teacherData).forEach(key => {
        if (allowedFields.includes(key)) filteredTeacherData[key] = teacherData[key];
      });

      // Ensure employeeId is never modified
      if (teacherData.employeeId && teacherData.employeeId !== teacher.employeeId) {
        return res.status(400).json({ success: false, message: 'Employee ID cannot be modified' });
      }

      // Ensure classes is not empty
      if (filteredTeacherData.classes && filteredTeacherData.classes.length === 0) {
        filteredTeacherData.classes = ['Not assigned'];
      }

      // Ensure subjects is not empty
      if (filteredTeacherData.subjects && filteredTeacherData.subjects.length === 0) {
        filteredTeacherData.subjects = ['Not assigned'];
      }

      const updatedTeacher = await TenantTeacher.findOneAndUpdate(
        { _id: teacher._id, tenant: req.tenantId },
        filteredTeacherData,
        { new: true, runValidators: true }
      );
      updatedData.teacher = updatedTeacher;
    }

    // Update user data if provided
    if (userData) {
      const allowedFields = ['name', 'email', 'profileImage'];
      const filteredUserData = {};

      Object.keys(userData).forEach(key => {
        if (allowedFields.includes(key)) filteredUserData[key] = userData[key];
      });

      const user = await TenantUser.findOneAndUpdate(
        { _id: req.user.id, tenant: req.tenantId },
        filteredUserData,
        { new: true, runValidators: true }
      );
      updatedData.user = user;
    }

    res.status(200).json({ success: true, data: updatedData });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Delete teacher
// @route   DELETE /api/teachers/:id
// @access  Private/Admin/Principal
exports.deleteTeacher = async (req, res) => {
  try {
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
    const TenantUser = getTenantModel(req, 'User', User.schema);

    const teacher = await TenantTeacher.findOne({ _id: req.params.id, tenant: req.tenantId });
    if (!teacher) {
      return res.status(404).json({ success: false, message: `No teacher found with id ${req.params.id}` });
    }

    const userId = teacher.user;
    await teacher.deleteOne();
    await TenantUser.findOneAndDelete({ _id: userId, tenant: req.tenantId });

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
