const SupportStaff = require('../models/SupportStaff');
const User = require('../models/User');

// @desc    Get all support staff
// @route   GET /api/support-staff
// @access  Private
exports.getSupportStaff = async (req, res) => {
  try {
    let supportStaff = await SupportStaff.find().populate({
      path: 'user',
      select: 'name email role profileImage isApproved status'
    });

    // Filter out support staff whose users are not approved or inactive
    supportStaff = supportStaff.filter(staff =>
      staff.user && staff.user.isApproved && staff.user.status === 'active'
    );

    res.status(200).json({
      success: true,
      count: supportStaff.length,
      data: supportStaff
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single support staff
// @route   GET /api/support-staff/:id
// @access  Private
exports.getSupportStaffMember = async (req, res) => {
  try {
    const supportStaff = await SupportStaff.findById(req.params.id)
      .populate({
        path: 'user',
        select: 'name email role profileImage'
      })
      .populate('attendanceRecords')
      .populate('salaryRecords');

    if (!supportStaff) {
      return res.status(404).json({
        success: false,
        message: `No support staff found with id ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: supportStaff
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create support staff
// @route   POST /api/support-staff
// @access  Private/Admin
exports.createSupportStaff = async (req, res) => {
  try {
    const { userData, supportStaffData } = req.body;

    // Check if profile image is provided
    if (!userData.profileImage) {
      return res.status(400).json({
        success: false,
        message: 'Profile picture is required'
      });
    }

    // First create a user with role support-staff and auto-approve
    userData.role = 'support-staff';
    userData.isApproved = true;
    userData.status = 'active';
    userData.approvedBy = req.user.id;
    userData.approvedAt = Date.now();
    const user = await User.create(userData);

    // Then create support staff profile with user reference
    supportStaffData.user = user._id;
    const supportStaff = await SupportStaff.create(supportStaffData);

    res.status(201).json({
      success: true,
      data: {
        supportStaff,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update support staff
// @route   PUT /api/support-staff/:id
// @access  Private/Admin
exports.updateSupportStaff = async (req, res) => {
  try {
    const { userData, supportStaffData } = req.body;
    let updatedData = {};

    // Update support staff data if provided
    if (supportStaffData) {
      const supportStaff = await SupportStaff.findByIdAndUpdate(
        req.params.id,
        supportStaffData,
        {
          new: true,
          runValidators: true
        }
      );

      if (!supportStaff) {
        return res.status(404).json({
          success: false,
          message: `No support staff found with id ${req.params.id}`
        });
      }

      updatedData.supportStaff = supportStaff;
    }

    // Update user data if provided
    if (userData) {
      const supportStaff = await SupportStaff.findById(req.params.id);

      if (!supportStaff) {
        return res.status(404).json({
          success: false,
          message: `No support staff found with id ${req.params.id}`
        });
      }

      const user = await User.findByIdAndUpdate(
        supportStaff.user,
        userData,
        {
          new: true,
          runValidators: true
        }
      );

      updatedData.user = user;
    }

    res.status(200).json({
      success: true,
      data: updatedData
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete support staff
// @route   DELETE /api/support-staff/:id
// @access  Private/Admin
exports.deleteSupportStaff = async (req, res) => {
  try {
    const supportStaff = await SupportStaff.findById(req.params.id);

    if (!supportStaff) {
      return res.status(404).json({
        success: false,
        message: `No support staff found with id ${req.params.id}`
      });
    }

    // Get user ID before deleting support staff
    const userId = supportStaff.user;

    // Delete support staff
    await supportStaff.deleteOne();

    // Delete associated user
    await User.findByIdAndDelete(userId);

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
