const Billing = require('../models/Billing');
const BillingService = require('../services/billingService');
const { FEATURE_PRICING } = require('../config/pricing');

// @desc    Generate monthly bills for all tenants
// @route   POST /api/billing/generate
// @access  Private (Super Admin)
exports.generateMonthlyBills = async (req, res) => {
  try {
    const { month, year } = req.body;
    const results = await BillingService.generateMonthlyBills(month, year);
    
    res.json({
      success: true,
      message: 'Monthly bills generated',
      data: results
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get tenant billing history
// @route   GET /api/billing/tenant/:tenantId
// @access  Private
exports.getTenantBilling = async (req, res) => {
  try {
    const { tenantId } = req.params;
    const { page = 1, limit = 10 } = req.query;
    
    const bills = await Billing.find({ tenant: tenantId })
      .sort({ 'billingPeriod.year': -1, 'billingPeriod.month': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Billing.countDocuments({ tenant: tenantId });
    
    res.json({
      success: true,
      data: bills,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current month bill for tenant
// @route   GET /api/billing/current
// @access  Private
exports.getCurrentBill = async (req, res) => {
  try {
    const tenantId = req.user.tenant;
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    const bill = await Billing.findOne({
      tenant: tenantId,
      'billingPeriod.month': month,
      'billingPeriod.year': year
    });
    
    if (!bill) {
      return res.status(404).json({ success: false, message: 'No bill found for current month' });
    }
    
    res.json({ success: true, data: bill });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get pricing information
// @route   GET /api/billing/pricing
// @access  Public
exports.getPricing = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        features: FEATURE_PRICING,
        model: 'per-student-per-feature',
        minimumCharge: 10.00,
        description: 'Pay only for features you use, charged per student per month'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Calculate estimated cost
// @route   POST /api/billing/estimate
// @access  Public
exports.calculateEstimate = async (req, res) => {
  try {
    const { studentCount, features } = req.body;
    
    if (!studentCount || !Array.isArray(features)) {
      return res.status(400).json({ success: false, message: 'Student count and features array required' });
    }
    
    let totalCost = 0;
    const breakdown = [];
    
    features.forEach(feature => {
      const pricing = FEATURE_PRICING[feature];
      if (pricing) {
        const cost = pricing.price * studentCount;
        totalCost += cost;
        breakdown.push({
          feature,
          name: pricing.name,
          pricePerStudent: pricing.price,
          totalCost: cost
        });
      }
    });
    
    // Apply minimum charge
    const finalCost = Math.max(totalCost, 10.00);
    
    res.json({
      success: true,
      data: {
        studentCount,
        breakdown,
        subtotal: totalCost,
        minimumCharge: 10.00,
        finalCost,
        savings: totalCost < 10.00 ? 0 : null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark bill as paid
// @route   PUT /api/billing/:id/paid
// @access  Private (Super Admin)
exports.markBillPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const { stripeInvoiceId } = req.body;
    
    const bill = await BillingService.markBillPaid(id, stripeInvoiceId);
    
    if (!bill) {
      return res.status(404).json({ success: false, message: 'Bill not found' });
    }
    
    res.json({ success: true, data: bill });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get overdue bills
// @route   GET /api/billing/overdue
// @access  Private (Super Admin)
exports.getOverdueBills = async (req, res) => {
  try {
    const bills = await BillingService.getOverdueBills();
    res.json({ success: true, data: bills });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};