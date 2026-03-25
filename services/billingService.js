const Tenant = require('../models/Tenant');
const Billing = require('../models/Billing');
const User = require('../models/User');
const { FEATURE_PRICING, calculateMonthlyBilling } = require('../config/pricing');

class BillingService {
  // Generate monthly bills for all active tenants
  static async generateMonthlyBills(month = null, year = null) {
    const now = new Date();
    const billingMonth = month || now.getMonth() + 1;
    const billingYear = year || now.getFullYear();
    
    console.log(`Generating bills for ${billingMonth}/${billingYear}`);
    
    const tenants = await Tenant.find({ status: 'active' });
    const results = [];
    
    for (const tenant of tenants) {
      try {
        const bill = await this.generateTenantBill(tenant, billingMonth, billingYear);
        results.push({ tenant: tenant.schoolName, success: true, amount: bill.totalAmount });
      } catch (error) {
        console.error(`Failed to generate bill for ${tenant.schoolName}:`, error);
        results.push({ tenant: tenant.schoolName, success: false, error: error.message });
      }
    }
    
    return results;
  }
  
  // Generate bill for a specific tenant
  static async generateTenantBill(tenant, month, year) {
    // Check if bill already exists
    const existingBill = await Billing.findOne({
      tenant: tenant._id,
      'billingPeriod.month': month,
      'billingPeriod.year': year
    });
    
    if (existingBill) {
      throw new Error('Bill already exists for this period');
    }
    
    // Get student count from tenant database
    const studentCount = await this.getTenantStudentCount(tenant);
    
    // Get enabled features
    const enabledFeatures = tenant.settings?.features?.enabled || [];
    
    // Calculate feature costs
    const featureCosts = enabledFeatures.map(feature => {
      const pricing = FEATURE_PRICING[feature];
      if (!pricing) return null;
      
      return {
        feature,
        price: pricing.price,
        cost: pricing.price * studentCount
      };
    }).filter(Boolean);
    
    // Calculate total
    const totalAmount = calculateMonthlyBilling(studentCount, enabledFeatures);
    
    // Set due date (15th of next month)
    const dueDate = new Date(year, month, 15);
    
    // Create billing record
    const billing = new Billing({
      tenant: tenant._id,
      billingPeriod: { month, year },
      studentCount,
      enabledFeatures: featureCosts,
      totalAmount,
      dueDate
    });
    
    await billing.save();
    return billing;
  }
  
  // Get student count from tenant database
  static async getTenantStudentCount(tenant) {
    try {
      const mongoose = require('mongoose');
      const tenantDbUri = process.env.MONGODB_URI.replace(
        /\/[^\/]*\?/, 
        `/${tenant.databaseName}?`
      );
      
      const tenantConnection = mongoose.createConnection(tenantDbUri);
      const TenantUser = tenantConnection.model('User', User.schema);
      
      const count = await TenantUser.countDocuments({ 
        tenant: tenant._id, 
        role: 'student',
        status: { $ne: 'deleted' }
      });
      
      tenantConnection.close();
      return count;
    } catch (error) {
      console.error(`Error getting student count for ${tenant.schoolName}:`, error);
      return 0;
    }
  }
  
  // Mark bill as paid
  static async markBillPaid(billingId, stripeInvoiceId = null) {
    const billing = await Billing.findByIdAndUpdate(
      billingId,
      {
        status: 'paid',
        paidAt: new Date(),
        ...(stripeInvoiceId && { stripeInvoiceId })
      },
      { new: true }
    );
    
    return billing;
  }
  
  // Get overdue bills
  static async getOverdueBills() {
    const now = new Date();
    return await Billing.find({
      status: 'pending',
      dueDate: { $lt: now }
    }).populate('tenant', 'schoolName email');
  }
  
  // Update overdue bills status
  static async updateOverdueBills() {
    const now = new Date();
    const result = await Billing.updateMany(
      {
        status: 'pending',
        dueDate: { $lt: now }
      },
      { status: 'overdue' }
    );
    
    return result;
  }
}

module.exports = BillingService;