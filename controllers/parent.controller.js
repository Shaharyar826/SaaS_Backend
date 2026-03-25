const Parent = require('../models/Parent');
const Student = require('../models/Student');
const User = require('../models/User');
const Fee = require('../models/Fee');
const Attendance = require('../models/Attendance');
const Notice = require('../models/Notice');
const asyncHandler = require('../middleware/async');
const { getTenantModel } = require('../middleware/tenant');

// @desc    Get parent dashboard data
// @route   GET /api/parent/dashboard
// @access  Private (Parent only)
exports.getParentDashboard = asyncHandler(async (req, res) => {
  const TenantParent = getTenantModel(req, 'Parent', Parent.schema);
  const TenantStudent = getTenantModel(req, 'Student', Student.schema);
  const TenantUser = getTenantModel(req, 'User', User.schema);
  const TenantFee = getTenantModel(req, 'Fee', Fee.schema);
  const TenantAttendance = getTenantModel(req, 'Attendance', Attendance.schema);

  const parent = await TenantParent.findOne({ 
    user: req.user.id, 
    tenant: req.tenantId 
  }).populate({
    path: 'children',
    populate: { path: 'user' }
  });

  if (!parent) {
    return res.status(404).json({
      success: false,
      message: 'Parent profile not found'
    });
  }

  const childrenData = await Promise.all(parent.children.map(async (child) => {
    const fees = await TenantFee.find({ student: child._id });
    const totalFees = fees.reduce((sum, fee) => sum + fee.amount, 0);
    const paidFees = fees.reduce((sum, fee) => sum + fee.amountPaid, 0);
    const pendingFees = totalFees - paidFees;

    const attendanceCount = await TenantAttendance.countDocuments({
      userId: child._id,
      userType: 'student',
      status: 'present'
    });

    return {
      id: child._id,
      name: child.user.name,
      rollNumber: child.rollNumber,
      class: child.class,
      section: child.section,
      totalFees,
      paidFees,
      pendingFees,
      attendanceCount
    };
  }));

  res.status(200).json({
    success: true,
    data: {
      parent: {
        name: req.user.name,
        email: req.user.email,
        relationship: parent.relationship
      },
      children: childrenData
    }
  });
});

// @desc    Get all children details
// @route   GET /api/parent/children
// @access  Private (Parent only)
exports.getChildren = asyncHandler(async (req, res) => {
  const TenantParent = getTenantModel(req, 'Parent', Parent.schema);
  
  const parent = await TenantParent.findOne({ 
    user: req.user.id, 
    tenant: req.tenantId 
  }).populate({
    path: 'children',
    populate: { path: 'user' }
  });

  if (!parent) {
    return res.status(404).json({
      success: false,
      message: 'Parent profile not found'
    });
  }

  res.status(200).json({
    success: true,
    data: parent.children
  });
});

// @desc    Get child fee records
// @route   GET /api/parent/children/:childId/fees
// @access  Private (Parent only)
exports.getChildFees = asyncHandler(async (req, res) => {
  const TenantParent = getTenantModel(req, 'Parent', Parent.schema);
  const TenantFee = getTenantModel(req, 'Fee', Fee.schema);

  const parent = await TenantParent.findOne({ 
    user: req.user.id, 
    tenant: req.tenantId 
  });

  if (!parent || !parent.children.includes(req.params.childId)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const fees = await TenantFee.find({ 
    student: req.params.childId,
    tenant: req.tenantId 
  }).populate('student').sort('-createdAt');

  res.status(200).json({
    success: true,
    count: fees.length,
    data: fees
  });
});

// @desc    Get child attendance records
// @route   GET /api/parent/children/:childId/attendance
// @access  Private (Parent only)
exports.getChildAttendance = asyncHandler(async (req, res) => {
  const TenantParent = getTenantModel(req, 'Parent', Parent.schema);
  const TenantAttendance = getTenantModel(req, 'Attendance', Attendance.schema);

  const parent = await TenantParent.findOne({ 
    user: req.user.id, 
    tenant: req.tenantId 
  });

  if (!parent || !parent.children.includes(req.params.childId)) {
    return res.status(403).json({
      success: false,
      message: 'Access denied'
    });
  }

  const { startDate, endDate } = req.query;
  const query = {
    userId: req.params.childId,
    userType: 'student',
    tenant: req.tenantId
  };

  if (startDate && endDate) {
    query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
  }

  const attendance = await TenantAttendance.find(query).sort('-date');

  const stats = {
    total: attendance.length,
    present: attendance.filter(a => a.status === 'present').length,
    absent: attendance.filter(a => a.status === 'absent').length,
    late: attendance.filter(a => a.status === 'late').length
  };

  res.status(200).json({
    success: true,
    data: attendance,
    stats
  });
});

// @desc    Get notices for parent
// @route   GET /api/parent/notices
// @access  Private (Parent only)
exports.getNotices = asyncHandler(async (req, res) => {
  const TenantNotice = getTenantModel(req, 'Notice', Notice.schema);

  const notices = await TenantNotice.find({ 
    tenant: req.tenantId,
    targetAudience: { $in: ['all', 'parents'] }
  }).sort('-createdAt').limit(20);

  res.status(200).json({
    success: true,
    count: notices.length,
    data: notices
  });
});
