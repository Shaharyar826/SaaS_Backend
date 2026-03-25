const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');

// Middleware to check if tenant has access to specific features
const checkFeatureAccess = (requiredFeature) => {
  return async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context required'
        });
      }

      // Get tenant with subscription
      const tenant = await Tenant.findById(tenantId).populate('subscription');
      
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Check if tenant has completed onboarding
      if (!tenant.onboardingComplete) {
        return res.status(403).json({
          success: false,
          message: 'Please complete your school setup first',
          redirectTo: '/setup'
        });
      }

      // Check subscription status
      if (!tenant.subscription || !tenant.subscription.isActive()) {
        return res.status(403).json({
          success: false,
          message: 'Your subscription is not active. Please update your billing.',
          redirectTo: '/subscription'
        });
      }

      // Check if feature is enabled
      const hasFeature = tenant.subscription.hasFeature(requiredFeature) || 
                        tenant.settings?.features?.enabled?.includes(requiredFeature);

      if (!hasFeature) {
        return res.status(403).json({
          success: false,
          message: `This feature (${requiredFeature}) is not available in your current plan.`,
          featureRequired: requiredFeature,
          redirectTo: '/subscription'
        });
      }

      // Add feature info to request for further use
      req.tenantFeatures = tenant.subscription.features;
      req.tenantLimits = tenant.subscription.limits;
      
      next();
    } catch (error) {
      console.error('Feature access check failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify feature access'
      });
    }
  };
};

// Middleware to check resource limits
const checkResourceLimit = (resourceType) => {
  return async (req, res, next) => {
    try {
      const tenantId = req.tenantId;
      
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant context required'
        });
      }

      const tenant = await Tenant.findById(tenantId).populate('subscription');
      
      if (!tenant || !tenant.subscription) {
        return res.status(404).json({
          success: false,
          message: 'Tenant or subscription not found'
        });
      }

      const subscription = tenant.subscription;
      const currentUsage = subscription.usage[resourceType] || 0;
      const limit = subscription.limits[`max${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`];

      // -1 means unlimited
      if (limit !== -1 && currentUsage >= limit) {
        return res.status(403).json({
          success: false,
          message: `You have reached your ${resourceType} limit (${limit}). Please upgrade your plan.`,
          currentUsage,
          limit,
          resourceType,
          redirectTo: '/subscription'
        });
      }

      req.resourceUsage = { current: currentUsage, limit };
      next();
    } catch (error) {
      console.error('Resource limit check failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to verify resource limits'
      });
    }
  };
};

// Helper function to update resource usage
const updateResourceUsage = async (tenantId, resourceType, increment = 1) => {
  try {
    const tenant = await Tenant.findById(tenantId).populate('subscription');
    if (tenant && tenant.subscription) {
      tenant.subscription.usage[resourceType] = (tenant.subscription.usage[resourceType] || 0) + increment;
      await tenant.subscription.save();
    }
  } catch (error) {
    console.error('Failed to update resource usage:', error);
  }
};

module.exports = {
  checkFeatureAccess,
  checkResourceLimit,
  updateResourceUsage
};