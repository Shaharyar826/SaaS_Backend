const express = require('express');
const router = express.Router();
const { protectSuperAdmin, preventSuperAdminDeletion } = require('../middleware/superAdminAuth');
const {
  login,
  logout,
  getMe,
  getDashboard,
  getTenants,
  updateTenantStatus,
  deleteTenant,
  getUsers,
  updateUserStatus,
  deleteUser,
  getAnalytics,
  getBillingOverview,
  getBillingTransactions,
  getSettings,
  updateSettings
} = require('../controllers/superAdmin.controller');

// Apply deletion protection middleware
router.use(preventSuperAdminDeletion);

// Auth routes
router.post('/auth/login', login);
router.post('/auth/logout', logout);
router.get('/auth/me', protectSuperAdmin, getMe);

// Dashboard
router.get('/dashboard', protectSuperAdmin, getDashboard);

// Tenant management
router.get('/tenants', protectSuperAdmin, getTenants);
router.put('/tenants/:id/status', protectSuperAdmin, updateTenantStatus);
router.delete('/tenants/:id', protectSuperAdmin, deleteTenant);

// User management
router.get('/users', protectSuperAdmin, getUsers);
router.put('/users/:id/status', protectSuperAdmin, updateUserStatus);
router.delete('/users/:id', protectSuperAdmin, deleteUser);

// Analytics
router.get('/analytics', protectSuperAdmin, getAnalytics);

// Billing
router.get('/billing/overview', protectSuperAdmin, getBillingOverview);
router.get('/billing/transactions', protectSuperAdmin, getBillingTransactions);

// Settings
router.get('/settings', protectSuperAdmin, getSettings);
router.put('/settings', protectSuperAdmin, updateSettings);

module.exports = router;