const express = require('express');
const router = express.Router();
const {
  getTenantConfig,
  updateTenantConfig,
  getTenantUsers,
  createTenantUser,
  updateTenantUser,
  disableTenantUser,
  getBillingInfo,
  getInvoices,
  updateFeatures,
  exportData
} = require('../controllers/tenantAdmin.controller');
const { protect, authorize } = require('../middleware/auth');

router.use(protect);
router.use(authorize('tenant_system_admin'));

router.get('/config', getTenantConfig);
router.put('/config', updateTenantConfig);

router.get('/users', getTenantUsers);
router.post('/users', createTenantUser);
router.put('/users/:id', updateTenantUser);
router.put('/users/:id/disable', disableTenantUser);

router.get('/billing', getBillingInfo);
router.get('/invoices', getInvoices);

router.put('/features', updateFeatures);

router.get('/export', exportData);

module.exports = router;
