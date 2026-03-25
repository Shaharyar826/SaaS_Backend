const Tenant = require('../models/Tenant');
const User = require('../models/User');

class StudentLimitService {
  // Get tenant's student limit from their setup
  static async getTenantStudentLimit(tenantId) {
    try {
      const tenant = await Tenant.findById(tenantId);
      return tenant?.settings?.studentLimit || 50; // Default limit
    } catch (error) {
      console.error('Error getting tenant student limit:', error);
      return 50; // Default fallback
    }
  }

  // Get current student count for tenant
  static async getCurrentStudentCount(tenantId) {
    try {
      return await User.countDocuments({ 
        tenant: tenantId, 
        role: 'student',
        status: { $ne: 'deleted' }
      });
    } catch (error) {
      console.error('Error getting current student count:', error);
      return 0;
    }
  }

  // Check if adding students would exceed limit
  static async canAddStudents(tenantId, countToAdd = 1) {
    const limit = await this.getTenantStudentLimit(tenantId);
    const current = await this.getCurrentStudentCount(tenantId);
    
    return {
      canAdd: (current + countToAdd) <= limit,
      currentCount: current,
      limit: limit,
      remaining: Math.max(0, limit - current)
    };
  }

  // Update tenant student limit
  static async updateStudentLimit(tenantId, newLimit) {
    try {
      await Tenant.findByIdAndUpdate(tenantId, {
        'settings.studentLimit': newLimit
      });
      return true;
    } catch (error) {
      console.error('Error updating student limit:', error);
      return false;
    }
  }
}

module.exports = StudentLimitService;