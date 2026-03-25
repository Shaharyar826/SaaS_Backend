const AdminStaff = require('../models/AdminStaff');
const User = require('../models/User');
const mongoose = require('mongoose');
const { getTenantModel } = require('../middleware/tenant');
const SAAS_CONFIG = require('../config/saas');

// @desc    Get all admin staff
// @route   GET /api/admin-staff
// @access  Private
exports.getAdminStaff = async (req, res) => {
  try {
    const TenantAdminStaff = getTenantModel(req, 'AdminStaff', AdminStaff.schema);
    let adminStaff = await TenantAdminStaff.find({ tenant: req.tenantId }).populate({
      path: 'user',
      select: 'name email role profileImage isApproved status'
    });

    // Filter out admin staff whose users are not approved or inactive
    adminStaff = adminStaff.filter(staff =>
      staff.user && staff.user.isApproved && staff.user.status === 'active'
    );

    res.status(200).json({
      success: true,
      count: adminStaff.length,
      data: adminStaff
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single admin staff
// @route   GET /api/admin-staff/:id
// @access  Private
exports.getAdminStaffMember = async (req, res) => {
  try {
    const TenantAdminStaff = getTenantModel(req, 'AdminStaff', AdminStaff.schema);
    const adminStaff = await TenantAdminStaff.findOne({ _id: req.params.id, tenant: req.tenantId })
      .populate({
        path: 'user',
        select: 'name email role profileImage'
      })
      .populate('attendanceRecords')
      .populate('salaryRecords');

    if (!adminStaff) {
      return res.status(404).json({
        success: false,
        message: `No admin staff found with id ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: adminStaff
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create admin staff
// @route   POST /api/admin-staff
// @access  Private/Admin
exports.createAdminStaff = async (req, res) => {
  try {
    const { userData, adminStaffData } = req.body;

    if (!userData.profileImage) {
      return res.status(400).json({
        success: false,
        message: 'Profile picture is required'
      });
    }

    // Generate email for admin staff if not provided
    if (!userData.email) {
      userData.email = SAAS_CONFIG.generateEmail('adm', userData.firstName, userData.lastName, req.tenant.subdomain);
      
      // Check for duplicates and increment if needed
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
    }

    const TenantUser = getTenantModel(req, 'User', User.schema);
    const TenantAdminStaff = getTenantModel(req, 'AdminStaff', AdminStaff.schema);

    // Create user with tenant isolation
    userData.tenant = req.tenantId;
    userData.role = userData.role || 'admin';
    userData.isApproved = true;
    userData.status = 'active';
    userData.approvedBy = req.user.id;
    userData.approvedAt = Date.now();
    const user = await TenantUser.create(userData);

    // Create admin staff profile with tenant isolation
    adminStaffData.tenant = req.tenantId;
    adminStaffData.user = user._id;
    const adminStaff = await TenantAdminStaff.create(adminStaffData);

    res.status(201).json({
      success: true,
      data: {
        adminStaff,
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

// @desc    Update admin staff
// @route   PUT /api/admin-staff/:id
// @access  Private/Admin
exports.updateAdminStaff = async (req, res) => {
  try {
    const { userData, adminStaffData } = req.body;
    let updatedData = {};

    const TenantAdminStaff = getTenantModel(req, 'AdminStaff', AdminStaff.schema);
    const TenantUser = getTenantModel(req, 'User', User.schema);

    if (adminStaffData) {
      const adminStaff = await TenantAdminStaff.findOneAndUpdate(
        { _id: req.params.id, tenant: req.tenantId },
        adminStaffData,
        {
          new: true,
          runValidators: true
        }
      );

      if (!adminStaff) {
        return res.status(404).json({
          success: false,
          message: `No admin staff found with id ${req.params.id}`
        });
      }

      updatedData.adminStaff = adminStaff;
    }

    if (userData) {
      const adminStaff = await TenantAdminStaff.findOne({ _id: req.params.id, tenant: req.tenantId });

      if (!adminStaff) {
        return res.status(404).json({
          success: false,
          message: `No admin staff found with id ${req.params.id}`
        });
      }

      const user = await TenantUser.findOneAndUpdate(
        { _id: adminStaff.user, tenant: req.tenantId },
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

// @desc    Delete admin staff
// @route   DELETE /api/admin-staff/:id
// @access  Private/Admin
exports.deleteAdminStaff = async (req, res) => {
  try {
    const TenantAdminStaff = getTenantModel(req, 'AdminStaff', AdminStaff.schema);
    const TenantUser = getTenantModel(req, 'User', User.schema);
    
    const adminStaff = await TenantAdminStaff.findOne({ _id: req.params.id, tenant: req.tenantId });

    if (!adminStaff) {
      return res.status(404).json({
        success: false,
        message: `No admin staff found with id ${req.params.id}`
      });
    }

    const userId = adminStaff.user;

    await TenantAdminStaff.findOneAndDelete({ _id: req.params.id, tenant: req.tenantId });
    await TenantUser.findOneAndDelete({ _id: userId, tenant: req.tenantId });

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

// @desc    Get admin staff profile for logged in user
// @route   GET /api/admin-staff/profile
// @access  Private/Admin,Principal
exports.getAdminStaffProfile = async (req, res) => {
  try {
    const TenantAdminStaff = getTenantModel(req, 'AdminStaff', AdminStaff.schema);
    const adminStaff = await TenantAdminStaff.findOne({ user: req.user.id, tenant: req.tenantId })
      .populate({
        path: 'user',
        select: 'firstName middleName lastName name email role profileImage'
      });

    if (!adminStaff) {
      return res.status(404).json({
        success: false,
        message: 'No admin staff profile found for this user'
      });
    }

    res.status(200).json({
      success: true,
      data: adminStaff
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update admin staff profile for logged in user
// @route   PUT /api/admin-staff/profile
// @access  Private/Admin,Principal
exports.updateAdminStaffProfile = async (req, res) => {
  try {
    const { userData, adminStaffData } = req.body;
    let updatedData = {};

    const TenantAdminStaff = getTenantModel(req, 'AdminStaff', AdminStaff.schema);
    const TenantUser = getTenantModel(req, 'User', User.schema);

    let adminStaff = await TenantAdminStaff.findOne({ user: req.user.id, tenant: req.tenantId });

    if (!adminStaff) {
      adminStaffData.tenant = req.tenantId;
      adminStaffData.user = req.user.id;
      adminStaff = await TenantAdminStaff.create(adminStaffData);
      updatedData.adminStaff = adminStaff;
    } else {
      adminStaff = await TenantAdminStaff.findOneAndUpdate(
        { _id: adminStaff._id, tenant: req.tenantId },
        adminStaffData,
        {
          new: true,
          runValidators: true
        }
      );
      updatedData.adminStaff = adminStaff;
    }

    if (userData) {
      const allowedFields = ['firstName', 'middleName', 'lastName', 'email', 'profileImage'];
      const filteredUserData = {};

      Object.keys(userData).forEach(key => {
        if (allowedFields.includes(key)) {
          filteredUserData[key] = userData[key];
        }
      });

      const user = await TenantUser.findOneAndUpdate(
        { _id: req.user.id, tenant: req.tenantId },
        filteredUserData,
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
