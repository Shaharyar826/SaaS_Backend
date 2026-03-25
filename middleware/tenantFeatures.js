const Tenant = require('../models/Tenant');
const { DEFAULT_FEATURES, FEATURE_ROLES } = require('../config/features');

// Middleware to check if tenant has access to specific feature
const checkTenantFeature = (requiredFeature) => {
  return async (req, res, next) => {
    try {
      if (!req.tenant) {
        return res.status(403).json({
          success: false,
          message: 'Tenant context required'
        });
      }

      // Get tenant with settings
      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      // Check if feature is enabled
      const enabledFeatures = tenant.settings?.features?.enabled || DEFAULT_FEATURES;
      
      if (!enabledFeatures.includes(requiredFeature)) {
        return res.status(403).json({
          success: false,
          message: `Feature '${requiredFeature}' is not enabled for your account`,
          code: 'FEATURE_DISABLED',
          feature: requiredFeature
        });
      }

      // Check if user role can access this feature
      const userRole = req.user?.role;
      const allowedRoles = FEATURE_ROLES[requiredFeature];
      
      if (allowedRoles && !allowedRoles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          message: `Your role '${userRole}' cannot access feature '${requiredFeature}'`,
          code: 'ROLE_NOT_AUTHORIZED',
          feature: requiredFeature
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Server error checking feature access'
      });
    }
  };
};

module.exports = { checkTenantFeature };