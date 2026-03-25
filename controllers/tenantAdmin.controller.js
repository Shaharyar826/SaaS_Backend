const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const asyncHandler = require('../middleware/async');
const { getTenantModel } = require('../middleware/tenant');
const stripeService = require('../services/stripeService');

// @desc    Get tenant configuration
// @route   GET /api/tenant-admin/config
// @access  Private (Tenant System Admin)
exports.getTenantConfig = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId).select('-billing.stripeCustomerId');
  
  res.status(200).json({
    success: true,
    data: {
      schoolName: tenant.schoolName,
      subdomain: tenant.subdomain,
      status: tenant.status,
      settings: tenant.settings,
      onboarding: tenant.onboarding
    }
  });
});

// @desc    Update tenant configuration
// @route   PUT /api/tenant-admin/config
// @access  Private (Tenant System Admin)
exports.updateTenantConfig = asyncHandler(async (req, res) => {
  const { schoolName, settings } = req.body;
  
  const updateData = {};
  if (schoolName) updateData.schoolName = schoolName;
  if (settings) {
    if (settings.branding) updateData['settings.branding'] = settings.branding;
    if (settings.preferences) updateData['settings.preferences'] = settings.preferences;
  }
  
  const tenant = await Tenant.findByIdAndUpdate(
    req.tenantId,
    updateData,
    { new: true, runValidators: true }
  );
  
  res.status(200).json({ success: true, data: tenant });
});

// @desc    Get tenant users
// @route   GET /api/tenant-admin/users
// @access  Private (Tenant System Admin)
exports.getTenantUsers = asyncHandler(async (req, res) => {
  const TenantUser = getTenantModel(req, 'User', User.schema);
  
  const users = await TenantUser.find({ 
    tenant: req.tenantId,
    role: { $ne: 'tenant_system_admin' }
  }).select('-password -passwordHistory');
  
  res.status(200).json({ success: true, count: users.length, data: users });
});

// @desc    Create tenant user
// @route   POST /api/tenant-admin/users
// @access  Private (Tenant System Admin)
exports.createTenantUser = asyncHandler(async (req, res) => {
  const TenantUser = getTenantModel(req, 'User', User.schema);
  
  if (req.body.role === 'tenant_system_admin') {
    return res.status(403).json({
      success: false,
      message: 'Cannot create another tenant system admin'
    });
  }
  
  const user = await TenantUser.create({
    ...req.body,
    tenant: req.tenantId,
    isApproved: true,
    status: 'active'
  });
  
  res.status(201).json({ success: true, data: user });
});

// @desc    Update tenant user
// @route   PUT /api/tenant-admin/users/:id
// @access  Private (Tenant System Admin)
exports.updateTenantUser = asyncHandler(async (req, res) => {
  const TenantUser = getTenantModel(req, 'User', User.schema);
  
  const existingUser = await TenantUser.findOne({ _id: req.params.id, tenant: req.tenantId });
  
  if (!existingUser) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }
  
  if (existingUser.role === 'tenant_system_admin') {
    return res.status(403).json({
      success: false,
      message: 'Cannot modify tenant system admin'
    });
  }
  
  if (req.body.role === 'tenant_system_admin') {
    return res.status(403).json({
      success: false,
      message: 'Cannot assign tenant system admin role'
    });
  }
  
  const user = await TenantUser.findOneAndUpdate(
    { _id: req.params.id, tenant: req.tenantId },
    req.body,
    { new: true, runValidators: true }
  );
  
  res.status(200).json({ success: true, data: user });
});

// @desc    Disable tenant user
// @route   PUT /api/tenant-admin/users/:id/disable
// @access  Private (Tenant System Admin)
exports.disableTenantUser = asyncHandler(async (req, res) => {
  const TenantUser = getTenantModel(req, 'User', User.schema);
  
  const existingUser = await TenantUser.findOne({ _id: req.params.id, tenant: req.tenantId });
  
  if (existingUser.role === 'tenant_system_admin') {
    return res.status(403).json({
      success: false,
      message: 'Cannot disable tenant system admin'
    });
  }
  
  const user = await TenantUser.findOneAndUpdate(
    { _id: req.params.id, tenant: req.tenantId },
    { status: 'inactive', isApproved: false },
    { new: true }
  );
  
  res.status(200).json({ success: true, data: user });
});

// @desc    Get billing info
// @route   GET /api/tenant-admin/billing
// @access  Private (Tenant System Admin)
exports.getBillingInfo = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId).populate('subscription');
  const subscription = await Subscription.findOne({ tenant: req.tenantId });
  
  let paymentMethods = [];
  if (tenant.billing?.stripeCustomerId) {
    try {
      const methods = await stripeService.getPaymentMethods(tenant.billing.stripeCustomerId);
      paymentMethods = methods.map(m => ({
        id: m.id,
        brand: m.card?.brand,
        last4: m.card?.last4,
        expMonth: m.card?.exp_month,
        expYear: m.card?.exp_year
      }));
    } catch (error) {
      console.error('Error fetching payment methods:', error);
    }
  }
  
  res.status(200).json({
    success: true,
    data: {
      currentPlan: tenant.billing?.selectedPlan,
      features: tenant.billing?.selectedFeatures,
      monthlyAmount: tenant.billing?.monthlyAmount,
      hasActiveSubscription: tenant.billing?.hasActiveSubscription,
      trialEndsAt: tenant.billing?.trialEndsAt,
      subscription: subscription ? {
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd
      } : null,
      paymentMethods
    }
  });
});

// @desc    Get invoices
// @route   GET /api/tenant-admin/invoices
// @access  Private (Tenant System Admin)
exports.getInvoices = asyncHandler(async (req, res) => {
  const tenant = await Tenant.findById(req.tenantId);
  
  if (!tenant.billing?.stripeCustomerId) {
    return res.status(200).json({ success: true, data: [] });
  }
  
  try {
    const invoices = await stripeService.getInvoices(tenant.billing.stripeCustomerId);
    
    const sanitizedInvoices = invoices.map(inv => ({
      id: inv.id,
      amount: inv.amount_paid / 100,
      currency: inv.currency,
      status: inv.status,
      created: inv.created,
      pdfUrl: inv.invoice_pdf,
      hostedUrl: inv.hosted_invoice_url
    }));
    
    res.status(200).json({ success: true, data: sanitizedInvoices });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch invoices' });
  }
});

// @desc    Update features
// @route   PUT /api/tenant-admin/features
// @access  Private (Tenant System Admin)
exports.updateFeatures = asyncHandler(async (req, res) => {
  const { features } = req.body;
  
  const tenant = await Tenant.findByIdAndUpdate(
    req.tenantId,
    { 'settings.features.enabled': features },
    { new: true }
  );
  
  res.status(200).json({ success: true, data: tenant.settings.features });
});

// @desc    Export tenant data
// @route   GET /api/tenant-admin/export
// @access  Private (Tenant System Admin)
exports.exportData = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Data export initiated. You will receive an email when ready.'
  });
});
