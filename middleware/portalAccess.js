const Tenant = require('../models/Tenant');

// Middleware to check if portal is enabled for tenant
const checkPortalAccess = (portalType) => {
  return async (req, res, next) => {
    try {
      if (!req.tenant) {
        return res.status(403).json({
          success: false,
          message: 'Tenant context required'
        });
      }

      const tenant = await Tenant.findById(req.tenant._id);
      
      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant not found'
        });
      }

      const portals = tenant.settings?.portals || { student: true, teacher: true, parent: false };
      
      if (!portals[portalType]) {
        return res.status(403).json({
          success: false,
          message: `${portalType.charAt(0).toUpperCase() + portalType.slice(1)} portal is not enabled for your school`,
          code: 'PORTAL_DISABLED',
          portal: portalType
        });
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Server error checking portal access'
      });
    }
  };
};

module.exports = { checkPortalAccess };
