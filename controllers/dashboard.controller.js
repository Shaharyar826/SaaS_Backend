const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const Attendance = require('../models/Attendance');
const Fee = require('../models/Fee');
const EventNotice = require('../models/Notice');
const User = require('../models/User');
const Salary = require('../models/Salary');
const Meeting = require('../models/Meeting');
const Notification = require('../models/Notification');
const { getTenantModel } = require('../middleware/tenant');

// Helper function to get recent notices for teachers
const getTeacherNotices = async (TenantEventNotice, tenantId) => {
  return await TenantEventNotice.find({
    tenant: tenantId,
    isActive: true,
    $or: [
      { targetAudience: 'all' },
      { targetAudience: { $in: ['teachers'] } }
    ]
  })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate({
      path: 'createdBy',
      select: 'name role'
    });
};

// Import calculateStudentArrears function
const calculateStudentArrears = async (studentId) => {
  try {
    if (!studentId) {
      return { totalArrears: 0, breakdown: [] };
    }

    const currentDate = new Date();
    const startOfCurrentMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);

    // Get student's admission date
    const student = await Student.findById(studentId);
    if (!student) {
      return { totalArrears: 0, breakdown: [] };
    }

    const admissionDate = new Date(student.admissionDate);
    
    // Calculate the month AFTER admission (when fees should start)
    const monthAfterAdmission = new Date(admissionDate.getFullYear(), admissionDate.getMonth() + 1, 1);
    
    // If current month is same as admission month or before, no arrears
    if (startOfCurrentMonth <= new Date(admissionDate.getFullYear(), admissionDate.getMonth(), 1)) {
      return { totalArrears: 0, breakdown: [] };
    }

    // Find unpaid fees from the month AFTER admission till current month (exclusive)
    const previousFees = await Fee.find({
      student: studentId,
      dueDate: { 
        $lt: startOfCurrentMonth,
        $gte: monthAfterAdmission
      },
      status: { $in: ['unpaid', 'partial', 'overdue'] }
    }).sort({ dueDate: 1 });

    let totalArrears = 0;
    const breakdown = [];

    previousFees.forEach(fee => {
      const remainingAmount = fee.status === 'partial' ? fee.remainingAmount : fee.amount;
      if (remainingAmount > 0) {
        totalArrears += remainingAmount;
        breakdown.push({
          month: fee.dueDate.toLocaleString('default', { month: 'long', year: 'numeric' }),
          amount: remainingAmount,
          feeType: fee.feeType,
          status: fee.status
        });
      }
    });

    return { totalArrears, breakdown };
  } catch (error) {
    return { totalArrears: 0, breakdown: [] };
  }
};

// @desc    Get dashboard metrics
// @route   GET /api/dashboard/metrics
// @access  Private
exports.getDashboardMetrics = async (req, res) => {
  try {
    // Get tenant-scoped models
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
    const TenantAttendance = getTenantModel(req, 'Attendance', Attendance.schema);
    const TenantFee = getTenantModel(req, 'Fee', Fee.schema);
    const TenantEventNotice = getTenantModel(req, 'EventNotice', EventNotice.schema);
    const TenantMeeting = getTenantModel(req, 'Meeting', Meeting.schema);
    const TenantNotification = getTenantModel(req, 'Notification', Notification.schema);

    // Get total students (tenant-scoped)
    const totalStudents = await TenantStudent.countDocuments({ tenant: req.tenantId, isActive: true });

    // Get total teachers (tenant-scoped)
    const totalTeachers = await TenantTeacher.countDocuments({ tenant: req.tenantId, isActive: true });

    // Get today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAttendance = await TenantAttendance.countDocuments({
      tenant: req.tenantId,
      date: { $gte: today, $lt: tomorrow },
      status: 'present'
    });

    // Get total fees due amount from actual unpaid fee records (tenant-scoped)
    const feesDueResult = await TenantFee.aggregate([
      {
        $match: {
          tenant: req.tenantId,
          status: { $in: ['unpaid', 'partial', 'overdue'] },
          remainingAmount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$remainingAmount' }
        }
      }
    ]);

    const feesDue = feesDueResult.length > 0 ? feesDueResult[0].totalAmount : 0;

    // Get recent events and notices (last 5) based on user role (tenant-scoped)
    const recentNotices = await TenantEventNotice.find({
      tenant: req.tenantId,
      isActive: true,
      $or: [
        { targetAudience: 'all' },
        { targetAudience: { $in: [req.user.role === 'teacher' ? 'teachers' :
                                 req.user.role === 'student' ? 'students' :
                                 'staff'] } }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: 'createdBy',
        select: 'name role'
      });

    // Get upcoming meetings (tenant-scoped)
    const meetingDate = new Date();
    const upcomingMeetings = await TenantMeeting.find({
      tenant: req.tenantId,
      date: { $gte: meetingDate },
      participants: { $in: [req.user.role, 'all'] },
      isActive: true
    })
      .sort({ date: 1 })
      .limit(3)
      .populate({
        path: 'organizer',
        select: 'name role'
      });

    // Get unread notifications count (tenant-scoped)
    const unreadNotificationsCount = await TenantNotification.countDocuments({
      tenant: req.tenantId,
      user: req.user._id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        totalTeachers,
        todayAttendance,
        feesDue,
        recentNotices,
        upcomingMeetings,
        unreadNotificationsCount
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get admin dashboard metrics
// @route   GET /api/dashboard/admin-metrics
// @access  Private/Admin,Principal
exports.getAdminDashboardMetrics = async (req, res) => {
  try {
    // Get tenant-scoped models
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
    const TenantUser = getTenantModel(req, 'User', User.schema);
    const TenantFee = getTenantModel(req, 'Fee', Fee.schema);
    const TenantEventNotice = getTenantModel(req, 'EventNotice', EventNotice.schema);
    const TenantMeeting = getTenantModel(req, 'Meeting', Meeting.schema);
    const TenantNotification = getTenantModel(req, 'Notification', Notification.schema);

    // Get total students (tenant-scoped)
    const totalStudents = await TenantStudent.countDocuments({ tenant: req.tenantId, isActive: true });

    // Get total teachers (tenant-scoped)
    const totalTeachers = await TenantTeacher.countDocuments({ tenant: req.tenantId, isActive: true });

    // Get pending approvals count (tenant-scoped)
    const pendingApprovals = await TenantUser.countDocuments({
      tenant: req.tenantId,
      isApproved: false,
      status: 'on hold',
      isSystemAccount: { $ne: true }
    });

    // Get total fees due amount from actual unpaid fee records (tenant-scoped)
    const feesDueResult = await TenantFee.aggregate([
      {
        $match: {
          tenant: req.tenantId,
          status: { $in: ['unpaid', 'partial', 'overdue'] },
          remainingAmount: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$remainingAmount' }
        }
      }
    ]);

    const feesDue = feesDueResult.length > 0 ? feesDueResult[0].totalAmount : 0;

    // Get recent events and notices (last 5) for admin/principal (they can see all) (tenant-scoped)
    const recentNotices = await TenantEventNotice.find({ tenant: req.tenantId, isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: 'createdBy',
        select: 'name role'
      });

    // Get upcoming meetings for admin/principal (tenant-scoped)
    // Both admin and principal should see all meetings
    const meetingDate = new Date();
    const upcomingMeetings = await TenantMeeting.find({
      tenant: req.tenantId,
      date: { $gte: meetingDate },
      isActive: true
    })
      .sort({ date: 1 })
      .limit(3)
      .populate({
        path: 'organizer',
        select: 'name role'
      });

    // Get unread notifications count (tenant-scoped)
    const unreadNotificationsCount = await TenantNotification.countDocuments({
      tenant: req.tenantId,
      user: req.user._id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      data: {
        totalStudents,
        totalTeachers,
        pendingApprovals,
        feesDue,
        recentNotices,
        upcomingMeetings,
        unreadNotificationsCount
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get student dashboard metrics
// @route   GET /api/dashboard/student-metrics
// @access  Private/Student
exports.getStudentDashboardMetrics = async (req, res) => {
  try {
    // Get tenant-scoped models
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const TenantFee = getTenantModel(req, 'Fee', Fee.schema);
    const TenantAttendance = getTenantModel(req, 'Attendance', Attendance.schema);
    const TenantEventNotice = getTenantModel(req, 'EventNotice', EventNotice.schema);
    const TenantMeeting = getTenantModel(req, 'Meeting', Meeting.schema);
    const TenantNotification = getTenantModel(req, 'Notification', Notification.schema);

    // Find the student profile for the logged-in user (tenant-scoped)
    const student = await TenantStudent.findOne({ tenant: req.tenantId, user: req.user.id }).populate('user');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    // Get all fee records for this student (no date filtering) (tenant-scoped)
    const feeRecords = await TenantFee.find({
      tenant: req.tenantId,
      student: student._id
    });

    // Calculate fee statistics based on actual records only
    const totalFees = feeRecords.reduce((sum, fee) => sum + fee.amount, 0);
    const paidAmount = feeRecords.reduce((sum, fee) => sum + fee.paidAmount, 0);
    const pendingFees = feeRecords
      .filter(fee => fee.status !== 'paid')
      .reduce((sum, fee) => sum + fee.remainingAmount, 0);

    // Calculate overdue amount from actual overdue records
    const now = new Date();
    const overdueAmount = feeRecords
      .filter(fee => fee.dueDate < now && fee.status !== 'paid')
      .reduce((sum, fee) => sum + fee.remainingAmount, 0);

    // Get attendance for current month
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    
    const attendanceRecords = await TenantAttendance.find({
      tenant: req.tenantId,
      userId: student._id,
      userType: 'student',
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    const presentDays = attendanceRecords.filter(record => record.status === 'present').length;
    const totalDays = attendanceRecords.length;
    const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

    // Get recent notices for students (tenant-scoped)
    const recentNotices = await TenantEventNotice.find({
      tenant: req.tenantId,
      isActive: true,
      $or: [
        { targetAudience: 'all' },
        { targetAudience: { $in: ['students'] } }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate({
        path: 'createdBy',
        select: 'name role'
      });

    // Get upcoming meetings (tenant-scoped)
    const meetingDate = new Date();
    const upcomingMeetings = await TenantMeeting.find({
      tenant: req.tenantId,
      date: { $gte: meetingDate },
      participants: { $in: ['students', 'all'] },
      isActive: true
    })
      .sort({ date: 1 })
      .limit(3)
      .populate({
        path: 'organizer',
        select: 'name role'
      });

    // Get unread notifications count (tenant-scoped)
    const unreadNotificationsCount = await TenantNotification.countDocuments({
      tenant: req.tenantId,
      user: req.user._id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      data: {
        student: {
          name: student.user.name,
          rollNumber: student.rollNumber,
          class: student.class,
          section: student.section,
          admissionDate: student.admissionDate
        },
        attendance: {
          percentage: attendancePercentage,
          presentDays,
          totalDays
        },
        fees: {
          totalFees,
          paidAmount,
          pendingFees,
          overdue: overdueAmount
        },
        recentNotices,
        upcomingMeetings,
        unreadNotificationsCount
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get teacher dashboard metrics
// @route   GET /api/dashboard/teacher-metrics
// @access  Private/Teacher
exports.getTeacherDashboardMetrics = async (req, res) => {
  try {
    // Get tenant-scoped models
    const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
    const TenantStudent = getTenantModel(req, 'Student', Student.schema);
    const TenantAttendance = getTenantModel(req, 'Attendance', Attendance.schema);
    const TenantEventNotice = getTenantModel(req, 'EventNotice', EventNotice.schema);
    const TenantSalary = getTenantModel(req, 'Salary', Salary.schema);
    const TenantMeeting = getTenantModel(req, 'Meeting', Meeting.schema);
    const TenantNotification = getTenantModel(req, 'Notification', Notification.schema);

    const { classes } = req.query;
    let classArray = [];
    let teacher = null;

    // Check if classes were provided in the query
    if (classes && classes.trim() !== '') {
      // Classes provided in query
      classArray = classes.split(',').filter(cls => cls !== 'Not assigned');
    } else {
      // If no classes provided, find the teacher's classes (tenant-scoped)
      teacher = await TenantTeacher.findOne({ tenant: req.tenantId, user: req.user.id });

      if (!teacher) {
        const recentNotices = await getTeacherNotices(TenantEventNotice, req.tenantId);

        return res.status(200).json({
          success: true,
          data: {
            totalStudentsInClass: 0,
            attendanceToday: 0,
            pendingTasks: 0,
            recentNotices,
            classes: []
          },
          message: 'No teacher profile found. Please update your profile.'
        });
      }

      if (teacher.classes && teacher.classes.length > 0) {
        // Filter out 'Not assigned' from classes
        classArray = teacher.classes.filter(cls => cls !== 'Not assigned');
      }
    }

    // If no valid classes, return empty data
    if (classArray.length === 0) {
      const recentNotices = await getTeacherNotices(TenantEventNotice, req.tenantId);

      // Get latest salary record for this teacher (tenant-scoped)
      let latestSalary = null;
      if (teacher) {
        latestSalary = await TenantSalary.findOne({
          tenant: req.tenantId,
          staffType: 'teacher',
          teacher: teacher._id
        }).sort({ month: -1 });
      }

      return res.status(200).json({
        success: true,
        data: {
          totalStudentsInClass: 0,
          attendanceToday: 0,
          pendingTasks: 0,
          recentNotices,
          classes: [],
          latestSalary
        },
        message: 'No classes assigned. Please update your profile with assigned classes.'
      });
    }

    // Get total students in teacher's classes (tenant-scoped)
    const totalStudentsInClass = await TenantStudent.countDocuments({
      tenant: req.tenantId,
      class: { $in: classArray },
      isActive: true
    });

    // Get today's attendance for teacher's classes
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get student IDs in teacher's classes (tenant-scoped)
    const studentsInClass = await TenantStudent.find({
      tenant: req.tenantId,
      class: { $in: classArray },
      isActive: true
    });

    const studentIds = studentsInClass.map(student => student._id);

    // Count attendance records for these students today (tenant-scoped)
    const attendanceToday = await TenantAttendance.countDocuments({
      tenant: req.tenantId,
      date: { $gte: today, $lt: tomorrow },
      userType: 'student',
      userId: { $in: studentIds },
      status: 'present'
    });

    // Placeholder for pending tasks (could be assignments, etc.)
    const pendingTasks = 0;

    // Get recent events and notices relevant to teachers or all (tenant-scoped)
    const recentNotices = await getTeacherNotices(TenantEventNotice, req.tenantId);

    // Get latest salary record for this teacher (tenant-scoped)
    let latestSalary = null;
    if (teacher) {
      latestSalary = await TenantSalary.findOne({
        tenant: req.tenantId,
        staffType: 'teacher',
        teacher: teacher._id
      }).sort({ month: -1 });
    }

    // Get upcoming meetings for teacher (tenant-scoped)
    const meetingDate = new Date();
    const upcomingMeetings = await TenantMeeting.find({
      tenant: req.tenantId,
      date: { $gte: meetingDate },
      participants: { $in: ['teachers', 'all'] },
      isActive: true
    })
      .sort({ date: 1 })
      .limit(3)
      .populate({
        path: 'organizer',
        select: 'name role'
      });

    // Get unread notifications count (tenant-scoped)
    const unreadNotificationsCount = await TenantNotification.countDocuments({
      tenant: req.tenantId,
      user: req.user._id,
      isRead: false
    });

    res.status(200).json({
      success: true,
      data: {
        totalStudentsInClass,
        attendanceToday,
        pendingTasks,
        recentNotices,
        classes: classArray,
        latestSalary,
        upcomingMeetings,
        unreadNotificationsCount
      }
    });
  } catch (err) {
    // Error fetching teacher dashboard metrics
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
};
