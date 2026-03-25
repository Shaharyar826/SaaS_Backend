const User = require('../models/User');
const bcrypt = require('bcryptjs');
const { getTenantModel } = require('../middleware/tenant');

// @desc    Get all users
// @route   GET /api/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const TenantUser = getTenantModel(req, 'User', User.schema);
    const users = await TenantUser.find({ tenant: req.tenantId });

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single user
// @route   GET /api/users/:id
// @access  Private/Admin
exports.getUser = async (req, res) => {
  try {
    const TenantUser = getTenantModel(req, 'User', User.schema);
    const user = await TenantUser.findOne({ _id: req.params.id, tenant: req.tenantId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No user found with id ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create user
// @route   POST /api/users
// @access  Private/Admin
exports.createUser = async (req, res) => {
  try {
    const TenantUser = getTenantModel(req, 'User', User.schema);
    const userData = { ...req.body, tenant: req.tenantId };
    const user = await TenantUser.create(userData);

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update user
// @route   PUT /api/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const TenantUser = getTenantModel(req, 'User', User.schema);
    const user = await TenantUser.findOneAndUpdate(
      { _id: req.params.id, tenant: req.tenantId },
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No user found with id ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete user
// @route   DELETE /api/users/:id
// @access  Private/Admin
exports.deleteUser = async (req, res) => {
  try {
    const TenantUser = getTenantModel(req, 'User', User.schema);
    const user = await TenantUser.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: `No user found with id ${req.params.id}`
      });
    }

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

// @desc    Reset user password
// @route   POST /api/users/reset-password
// @access  Private
exports.resetPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both current and new passwords'
      });
    }

    const TenantUser = getTenantModel(req, 'User', User.schema);
    const user = await TenantUser.findOne({ _id: req.user.id, tenant: req.tenantId }).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if current password matches
    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const updateData = {
      password: hashedPassword
    };

    if (user.passwordResetRequired) {
      updateData.passwordResetRequired = false;
    }

    await TenantUser.findOneAndUpdate(
      { _id: user._id, tenant: req.tenantId },
      updateData
    );

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Reset user password after temporary password login
// @route   POST /api/users/reset-temp-password
// @access  Private
exports.resetTempPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a new password'
      });
    }

    const TenantUser = getTenantModel(req, 'User', User.schema);
    const user = await TenantUser.findOne({ _id: req.user.id, tenant: req.tenantId }).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.passwordResetRequired) {
      return res.status(400).json({
        success: false,
        message: 'Password reset not required for this account'
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await TenantUser.findOneAndUpdate(
      { _id: user._id, tenant: req.tenantId },
      {
        password: hashedPassword,
        passwordResetRequired: false
      }
    );

    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};