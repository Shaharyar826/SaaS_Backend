const User = require('../models/User');
const PasswordResetRequest = require('../models/PasswordResetRequest');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validateEmail } = require('../utils/validation');
const { SECURITY_CONFIG } = require('../config/security');

// @desc    Request password reset
// @route   POST /api/password-reset/request
// @access  Public
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email, securityAnswers } = req.body;

    // Validate email
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an email address'
      });
    }

    try {
      const validatedEmail = validateEmail(email);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message
      });
    }

    // Validate security answers
    if (!securityAnswers || !securityAnswers.favoriteColor || !securityAnswers.birthCity || !securityAnswers.petName) {
      return res.status(400).json({
        success: false,
        message: 'Please answer all security questions'
      });
    }

    // Check if user exists
    const user = await User.findOne({ email: validatedEmail });

    if (!user) {
      // Don't reveal if user exists or not
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset request has been submitted.'
      });
    }

    // Check if there's already a pending request for this user
    const existingRequest = await PasswordResetRequest.findOne({
      user: user._id,
      status: 'pending'
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'A password reset request is already pending for this account'
      });
    }

    // Generate secure temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase();
    console.log('Generated secure temporary password for user:', user.email);

    // Create password reset request
    const passwordResetRequest = await PasswordResetRequest.create({
      user: user._id,
      email: validatedEmail,
      securityAnswers,
      tempPassword
    });

    console.log('Created password reset request:', passwordResetRequest._id);

    res.status(200).json({
      success: true,
      message: 'Password reset request submitted. Please contact your administrator for approval.'
    });
  } catch (err) {
    console.error('Error in requestPasswordReset:', err);
    
    // Handle validation errors specifically
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Get all pending password reset requests
// @route   GET /api/password-reset/requests
// @access  Private/Admin,Principal
exports.getPasswordResetRequests = async (req, res) => {
  try {
    const requests = await PasswordResetRequest.find({ status: 'pending' })
      .populate({
        path: 'user',
        select: 'name email role'
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (err) {
    console.error('Error in getPasswordResetRequests:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Approve password reset request
// @route   PUT /api/password-reset/approve/:id
// @access  Private/Admin,Principal
exports.approvePasswordReset = async (req, res) => {
  try {
    const request = await PasswordResetRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Password reset request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${request.status}`
      });
    }

    // Get user
    const user = await User.findById(request.user).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Generate secure temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex').toUpperCase();

    // Use the static method to reset the password
    const resetResult = await User.resetPassword(user._id, tempPassword);

    if (!resetResult.success) {
      return res.status(500).json({
        success: false,
        message: `Failed to reset password: ${resetResult.message}`
      });
    }

    // Update the request's temp password to match what we just set
    request.tempPassword = tempPassword;

    // Log for security audit
    console.log(`Generated secure temporary password for user ${user.email} by admin ${req.user.id}`);

    // Update the request status
    request.status = 'approved';
    request.approvedBy = req.user.id;
    request.approvedAt = Date.now();
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Password reset request approved',
      data: {
        user: {
          name: user.name,
          email: user.email
        },
        tempPassword: request.tempPassword
      }
    });
  } catch (err) {
    console.error('Error in approvePasswordReset:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// @desc    Reject password reset request
// @route   PUT /api/password-reset/reject/:id
// @access  Private/Admin,Principal
exports.rejectPasswordReset = async (req, res) => {
  try {
    const request = await PasswordResetRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Password reset request not found'
      });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `This request has already been ${request.status}`
      });
    }

    // Update the request status
    request.status = 'rejected';
    request.rejectedBy = req.user.id;
    request.rejectedAt = Date.now();
    await request.save();

    res.status(200).json({
      success: true,
      message: 'Password reset request rejected'
    });
  } catch (err) {
    console.error('Error in rejectPasswordReset:', err);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};
