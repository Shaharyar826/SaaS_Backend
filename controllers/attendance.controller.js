const Attendance = require('../models/Attendance');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const AdminStaff = require('../models/AdminStaff');
const SupportStaff = require('../models/SupportStaff');
const { getTenantModel } = require('../middleware/tenant');

// @desc    Get all attendance records
// @route   GET /api/attendance
// @access  Private
exports.getAttendanceRecords = async (req, res) => {
  try {
    const TenantAttendance = getTenantModel(req, 'Attendance', Attendance.schema);
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    
    let query = { tenant: req.tenantId };
    const reqQuery = { ...req.query };

    // Handle date filtering
    if (reqQuery.date) {
      const dateStr = reqQuery.date;
      const startDate = new Date(dateStr);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateStr);
      endDate.setHours(23, 59, 59, 999);
      query.date = { $gte: startDate, $lte: endDate };
      delete reqQuery.date;
    }

    if (reqQuery.userType) {
      query.userType = reqQuery.userType;
      delete reqQuery.userType;
    }

    // For teachers, only show students from their assigned classes
    let teacherClasses = [];
    if (req.user.role === 'teacher') {
      const teacher = await TenantTeacher.findOne({ user: req.user.id, tenant: req.tenantId });
      if (teacher && teacher.classes && teacher.classes.length > 0) {
        teacherClasses = teacher.classes;
      }
    }

    // For students, only show their own attendance records
    if (req.user.role === 'student') {
      const student = await TenantStudent.findOne({ user: req.user.id, tenant: req.tenantId });
      if (student) {
        query.userType = 'student';
        query.userId = student._id;
      } else {
        return res.status(404).json({ success: false, message: 'Student profile not found' });
      }
    }

    const removeFields = ['select', 'sort', 'page', 'limit', 'class', 'section'];
    removeFields.forEach(param => delete reqQuery[param]);
    Object.keys(reqQuery).forEach(key => { query[key] = reqQuery[key]; });

    let attendanceQuery = TenantAttendance.find(query)
      .populate({ path: 'userId', populate: { path: 'user', select: 'name email' } })
      .populate({ path: 'recordedBy', select: 'name role' });

    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      attendanceQuery = attendanceQuery.select(fields);
    }

    attendanceQuery = attendanceQuery.sort(req.query.sort ? req.query.sort.split(',').join(' ') : '-date');

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    const total = await TenantAttendance.countDocuments(query);

    attendanceQuery = attendanceQuery.skip(startIndex).limit(limit);
    let attendanceRecords = await attendanceQuery;

    // Apply additional filtering for class and section
    if (req.query.class || req.query.section || (req.user.role === 'teacher' && teacherClasses.length > 0)) {
      attendanceRecords = await Promise.all(
        attendanceRecords.map(async (record) => {
          if (record.userType === 'student') {
            const student = await TenantStudent.findOne({ _id: record.userId, tenant: req.tenantId });
            if (!student) return null;

            if (req.user.role === 'teacher' && teacherClasses.length > 0) {
              if (!teacherClasses.includes(student.class)) return null;
            }
            if (req.query.class && student.class !== req.query.class) return null;
            if (req.query.section && student.section !== req.query.section) return null;
          }

          if (record.userType === 'teacher' && req.query.class) {
            const teacher = await TenantTeacher.findOne({ _id: record.userId, tenant: req.tenantId });
            if (!teacher.classes.includes(req.query.class)) return null;
          }

          return record;
        })
      );
      attendanceRecords = attendanceRecords.filter(record => record !== null);
    }

    const pagination = {};
    if (startIndex + limit < total) pagination.next = { page: page + 1, limit };
    if (startIndex > 0) pagination.prev = { page: page - 1, limit };

    res.status(200).json({ success: true, count: attendanceRecords.length, pagination, data: attendanceRecords });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// @desc    Get single attendance record
// @route   GET /api/attendance/:id
// @access  Private
exports.getAttendanceRecord = async (req, res) => {
  try {
    const TenantAttendance = getTenantModel(req, 'Attendance', Attendance.schema);
    
    const attendance = await TenantAttendance.findOne({ 
      _id: req.params.id, 
      tenant: req.tenantId 
    })
      .populate({
        path: 'userId',
        populate: {
          path: 'user',
          select: 'name email'
        }
      })
      .populate({
        path: 'recordedBy',
        select: 'name role'
      });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: `No attendance record found with id ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (err) {
    console.error('Error fetching attendance record:', err);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching attendance record'
    });
  }
};

// @desc    Create attendance record
// @route   POST /api/attendance
// @access  Private
exports.createAttendanceRecord = async (req, res) => {
  try {
    // Add user to req.body
    req.body.recordedBy = req.user.id;

    const { userType, userId, date, status, remarks } = req.body;

    // Validate required fields
    if (!userType || !userId || !status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide userType, userId, and status'
      });
    }

    // Role-based restrictions for user type
    if (req.user.role === 'teacher') {
      // Teachers can only mark attendance for students
      if (userType !== 'student') {
        return res.status(403).json({
          success: false,
          message: 'Teachers can only mark attendance for students'
        });
      }
    }

    // Validate date - prevent marking attendance for past dates
    if (date) {
      const selectedDate = new Date(date);
      const today = new Date();

      // Reset time part for accurate date comparison
      selectedDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot mark attendance for past dates. Please select today or a future date.'
        });
      }
    }

    // Get tenant-scoped models
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
    const TenantAdminStaff = getTenantModel(req, 'AdminStaff', AdminStaff.schema);
    const TenantSupportStaff = getTenantModel(req, 'SupportStaff', SupportStaff.schema);
    const TenantAttendance = getTenantModel(req, 'Attendance', Attendance.schema);

    // Determine the correct model based on userType
    let TenantModel;
    let userModel;

    switch (userType) {
      case 'student':
        TenantModel = TenantStudent;
        userModel = 'Student';
        break;
      case 'teacher':
        TenantModel = TenantTeacher;
        userModel = 'Teacher';
        break;
      case 'admin-staff':
        TenantModel = TenantAdminStaff;
        userModel = 'AdminStaff';
        break;
      case 'support-staff':
        TenantModel = TenantSupportStaff;
        userModel = 'SupportStaff';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid user type. Must be student, teacher, admin-staff, or support-staff'
        });
    }

    // Check if the user exists (tenant-scoped)
    const user = await TenantModel.findOne({ _id: userId, tenant: req.tenantId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No ${userType} found with id ${userId}`
      });
    }

    // For teachers marking student attendance, verify they teach the student's class
    if (req.user.role === 'teacher' && userType === 'student') {
      const teacher = await TenantTeacher.findOne({ user: req.user.id, tenant: req.tenantId });
      if (teacher && teacher.classes && teacher.classes.length > 0) {
        if (!teacher.classes.includes(user.class)) {
          return res.status(403).json({
            success: false,
            message: 'You can only mark attendance for students in your assigned classes'
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'No classes assigned to you'
        });
      }
    }

    // Create attendance record (tenant-scoped)
    const attendance = await TenantAttendance.create({
      tenant: req.tenantId,
      userType,
      userId,
      userModel,
      date: date || new Date(),
      status,
      remarks,
      recordedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: attendance
    });
  } catch (err) {
    console.error('Error creating attendance record:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update attendance record
// @route   PUT /api/attendance/:id
// @access  Private
exports.updateAttendanceRecord = async (req, res) => {
  try {
    const TenantAttendance = getTenantModel(req, 'Attendance', Attendance.schema);
    
    let attendance = await TenantAttendance.findOne({ _id: req.params.id, tenant: req.tenantId });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: `No attendance record found with id ${req.params.id}`
      });
    }

    // Make sure user is the record creator or an admin/principal
    if (
      attendance.recordedBy.toString() !== req.user.id &&
      req.user.role !== 'admin' &&
      req.user.role !== 'principal'
    ) {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this attendance record`
      });
    }

    // Extract updatable fields
    const { status, remarks, date } = req.body;
    const updateData = {};

    if (status) updateData.status = status;
    if (remarks !== undefined) updateData.remarks = remarks;

    // Validate date - prevent marking attendance for past dates
    if (date) {
      const selectedDate = new Date(date);
      const today = new Date();

      // Reset time part for accurate date comparison
      selectedDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot update attendance for past dates. Please select today or a future date.'
        });
      }

      updateData.date = date;
    }

    // Update the record (tenant-scoped)
    attendance = await TenantAttendance.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenantId },
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    res.status(200).json({
      success: true,
      data: attendance
    });
  } catch (err) {
    console.error('Error updating attendance record:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create test attendance record
// @route   GET /api/attendance/create-test
// @access  Private
exports.createTestAttendanceRecord = async (req, res) => {
  try {
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const TenantAttendance = getTenantModel(req, 'Attendance', Attendance.schema);
    
    // Find a student to create attendance for (tenant-scoped)
    const student = await TenantStudent.findOne({ tenant: req.tenantId });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'No student found to create test attendance'
      });
    }

    // Create attendance record (tenant-scoped)
    const attendance = await TenantAttendance.create({
      tenant: req.tenantId,
      date: new Date(),
      userType: 'student',
      userId: student._id,
      userModel: 'Student',
      status: 'present',
      remarks: 'Test attendance record created from backend',
      recordedBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: attendance
    });
  } catch (err) {
    console.error('Error creating test attendance record:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete attendance record
// @route   DELETE /api/attendance/:id
// @access  Private
exports.deleteAttendanceRecord = async (req, res) => {
  try {
    const TenantAttendance = getTenantModel(req, 'Attendance', Attendance.schema);
    
    const attendance = await TenantAttendance.findOne({ _id: req.params.id, tenant: req.tenantId });

    if (!attendance) {
      return res.status(404).json({
        success: false,
        message: `No attendance record found with id ${req.params.id}`
      });
    }

    // Make sure user is the record creator or an admin/principal
    if (
      attendance.recordedBy.toString() !== req.user.id &&
      req.user.role !== 'admin' &&
      req.user.role !== 'principal'
    ) {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this attendance record`
      });
    }

    await attendance.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    console.error('Error deleting attendance record:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create batch attendance records
// @route   POST /api/attendance/batch
// @access  Private
exports.createBatchAttendanceRecords = async (req, res) => {
  try {
    // Add user to req.body
    req.body.recordedBy = req.user.id;

    const { userType, userIds, date, status, remarks } = req.body;

    // Validate required fields
    if (!userType || !userIds || !Array.isArray(userIds) || userIds.length === 0 || !status) {
      return res.status(400).json({
        success: false,
        message: 'Please provide userType, userIds array, and status'
      });
    }

    // Role-based restrictions for user type
    if (req.user.role === 'teacher') {
      // Teachers can only mark attendance for students
      if (userType !== 'student') {
        return res.status(403).json({
          success: false,
          message: 'Teachers can only mark attendance for students'
        });
      }
    }

    // Validate date - prevent marking attendance for past dates
    if (date) {
      const selectedDate = new Date(date);
      const today = new Date();

      // Reset time part for accurate date comparison
      selectedDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Cannot mark attendance for past dates. Please select today or a future date.'
        });
      }
    }

    // Get tenant-scoped models
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
    const TenantAdminStaff = getTenantModel(req, 'AdminStaff', AdminStaff.schema);
    const TenantSupportStaff = getTenantModel(req, 'SupportStaff', SupportStaff.schema);
    const TenantAttendance = getTenantModel(req, 'Attendance', Attendance.schema);

    // Determine the correct model based on userType
    let TenantModel;
    let userModel;

    switch (userType) {
      case 'student':
        TenantModel = TenantStudent;
        userModel = 'Student';
        break;
      case 'teacher':
        TenantModel = TenantTeacher;
        userModel = 'Teacher';
        break;
      case 'admin-staff':
        TenantModel = TenantAdminStaff;
        userModel = 'AdminStaff';
        break;
      case 'support-staff':
        TenantModel = TenantSupportStaff;
        userModel = 'SupportStaff';
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid user type. Must be student, teacher, admin-staff, or support-staff'
        });
    }

    // Check if all users exist (tenant-scoped)
    const users = await TenantModel.find({ _id: { $in: userIds }, tenant: req.tenantId });

    if (users.length !== userIds.length) {
      return res.status(404).json({
        success: false,
        message: `Some ${userType}s were not found. Please refresh and try again.`
      });
    }

    // For teachers marking student attendance, verify they teach all students' classes
    if (req.user.role === 'teacher' && userType === 'student') {
      const teacher = await TenantTeacher.findOne({ user: req.user.id, tenant: req.tenantId });
      if (teacher && teacher.classes && teacher.classes.length > 0) {
        // Check if all students are from teacher's assigned classes
        for (const user of users) {
          if (!teacher.classes.includes(user.class)) {
            return res.status(403).json({
              success: false,
              message: `You can only mark attendance for students in your assigned classes. Student ${user.user?.name || user._id} is not in your assigned classes.`
            });
          }
        }
      } else {
        return res.status(403).json({
          success: false,
          message: 'No classes assigned to you'
        });
      }
    }

    // Create attendance records for all users (tenant-scoped)
    const attendanceRecords = [];

    for (const userId of userIds) {
      const attendanceRecord = await TenantAttendance.create({
        tenant: req.tenantId,
        userType,
        userId,
        userModel,
        date: date || new Date(),
        status,
        remarks,
        recordedBy: req.user.id
      });

      attendanceRecords.push(attendanceRecord);
    }

    res.status(201).json({
      success: true,
      count: attendanceRecords.length,
      data: attendanceRecords
    });
  } catch (err) {
    console.error('Error creating batch attendance records:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
