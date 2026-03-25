const Subscription = require('../models/Subscription');

// Check if tenant has access to specific feature
exports.requireFeature = (featureName) => {
  return async (req, res, next) => {
    try {
      const subscription = await Subscription.findOne({ 
        tenant: req.tenantId 
      });

      if (!subscription || !subscription.isActive()) {
        return res.status(403).json({
          success: false,
          message: 'Subscription expired or inactive',
          code: 'SUBSCRIPTION_INACTIVE'
        });
      }

      if (!subscription.hasFeature(featureName)) {
        return res.status(403).json({
          success: false,
          message: `Feature '${featureName}' not available in your plan`,
          code: 'FEATURE_NOT_AVAILABLE',
          upgradeRequired: true
        });
      }

      req.subscription = subscription;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Subscription check failed'
      });
    }
  };
};

// Check resource limits before creation
exports.checkLimit = (resource) => {
  return async (req, res, next) => {
    try {
      const subscription = await Subscription.findOne({ 
        tenant: req.tenantId 
      });

      if (!subscription) {
        return res.status(403).json({
          success: false,
          message: 'No active subscription'
        });
      }

      const currentCount = subscription.usage[resource] || 0;
      
      if (!subscription.isWithinLimit(resource, currentCount + 1)) {
        return res.status(403).json({
          success: false,
          message: `${resource} limit exceeded`,
          code: 'LIMIT_EXCEEDED',
          current: currentCount,
          limit: subscription.limits[`max${resource.charAt(0).toUpperCase() + resource.slice(1)}`],
          upgradeRequired: true
        });
      }

      req.subscription = subscription;
      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Limit check failed'
      });
    }
  };
};

// Update usage after successful operation
exports.trackUsage = (resource, increment = 1) => {
  return async (req, res, next) => {
    try {
      if (req.subscription) {
        await Subscription.findByIdAndUpdate(
          req.subscription._id,
          { $inc: { [`usage.${resource}`]: increment } }
        );
      }
      next();
    } catch (error) {
      // Don't fail the request if usage tracking fails
      console.error('Usage tracking failed:', error);
      next();
    }
  };
};