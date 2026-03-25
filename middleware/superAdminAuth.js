const jwt = require('jsonwebtoken');
const SuperAdmin = require('../models/SuperAdmin');
const { protect } = require('../middleware/auth');

// Middleware to protect super admin routes
const protectSuperAdmin = async (req, res, next) => {
  try {
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.superAdminToken) {
      token = req.cookies.superAdminToken;
    }
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const superAdmin = await SuperAdmin.findById(decoded.id);
    if (!superAdmin) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }
    
    req.superAdmin = superAdmin;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Not authorized' });
  }
};

// IMMUTABLE SUPER ADMIN - Cannot be deleted
const PROTECTED_SUPER_ADMIN = 'shahrayarrattar786110@gmail.com';

// Prevent deletion of protected super admin
const preventSuperAdminDeletion = async (req, res, next) => {
  // Only prevent deletion of super admin accounts, not tenants
  if (req.method === 'DELETE' && req.originalUrl.includes('super-admin') && !req.originalUrl.includes('tenants')) {
    return res.status(403).json({ 
      success: false, 
      message: 'Super admin cannot be deleted' 
    });
  }
  next();
};

// Protect Super Admin routes
exports.protectSuperAdmin = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.superAdminToken) {
    token = req.cookies.superAdminToken;
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if it's a super admin token
    if (decoded.type !== 'superadmin') {
      return res.status(401).json({ success: false, message: 'Not authorized as super admin' });
    }

    req.superAdmin = await SuperAdmin.findById(decoded.id);
    
    if (!req.superAdmin) {
      return res.status(401).json({ success: false, message: 'Super admin not found' });
    }

    if (req.superAdmin.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Super admin account is inactive' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};
module.exports = { protectSuperAdmin, preventSuperAdminDeletion, PROTECTED_SUPER_ADMIN };