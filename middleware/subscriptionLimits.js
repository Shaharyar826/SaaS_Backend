const Subscription = require('../models/Subscription');
const { getTenantModel } = require('./tenant');

// Check subscription limits for resource creation
exports.checkSubscriptionLimits = (resourceType) => {
  return async (req, res, next) => {
    try {
      // Skip for super admin routes
      if (!req.tenant || !req.tenantId) {
        return next();
      }

      let subscription;
      try {
        subscription = await Subscription.findOne({ tenant: req.tenantId });
      } catch (dbError) {
        console.error('Failed to fetch subscription:', dbError);
        return res.status(503).json({
          success: false,
          error: { message: 'Service temporarily unavailable', code: 503 }
        });
      }
      
      if (!subscription) {
        return res.status(403).json({
          success: false,
          error: { message: 'No active subscription found', code: 403 }
        });
      }

      // Check subscription status
      if (subscription.status === 'canceled' || subscription.status === 'past_due') {
        return res.status(403).json({
          success: false,
          error: { message: 'Subscription inactive. Please update your billing.', code: 403 }
        });
      }

      // Check resource-specific limits
      const limits = subscription.limits || {};
      
      try {
        switch (resourceType) {
          case 'student':
            if (limits.maxStudents && limits.maxStudents > 0) {
              const Student = require('../models/Student');
              const TenantStudent = getTenantModel(req, 'Student', Student.schema);
              const currentCount = await TenantStudent.countDocuments({ tenant: req.tenantId, isActive: true });
              
              if (currentCount >= limits.maxStudents) {
                return res.status(403).json({
                  success: false,
                  error: { 
                    message: `Student limit reached (${limits.maxStudents}). Please upgrade your plan.`, 
                    code: 403,
                    type: 'SUBSCRIPTION_LIMIT'
                  }
                });
              }
            }
            break;
            
          case 'teacher':
            if (limits.maxTeachers && limits.maxTeachers > 0) {
              const Teacher = require('../models/Teacher');
              const TenantTeacher = getTenantModel(req, 'Teacher', Teacher.schema);
              const currentCount = await TenantTeacher.countDocuments({ tenant: req.tenantId, isActive: true });
              
              if (currentCount >= limits.maxTeachers) {
                return res.status(403).json({
                  success: false,
                  error: { 
                    message: `Teacher limit reached (${limits.maxTeachers}). Please upgrade your plan.`, 
                    code: 403,
                    type: 'SUBSCRIPTION_LIMIT'
                  }
                });
              }
            }
            break;
        }
      } catch (countError) {
        console.error('Failed to check resource count:', countError);
        // Allow operation to continue if count check fails
      }

      next();
    } catch (error) {
      console.error('Subscription limit check failed:', error);
      res.status(500).json({
        success: false,
        error: { message: 'Service temporarily unavailable', code: 500 }
      });
    }
  };
};

// Update usage tracking
exports.updateUsage = async (tenantId, resourceType, increment = 1) => {
  try {
    const subscription = await Subscription.findOne({ tenant: tenantId });
    if (!subscription) return;

    if (!subscription.usage) {
      subscription.usage = {};
    }

    subscription.usage[resourceType] = (subscription.usage[resourceType] || 0) + increment;
    subscription.usage.lastUpdated = new Date();
    
    await subscription.save();
  } catch (error) {
    console.error('Failed to update usage:', error);
  }
};