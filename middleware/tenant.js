const mongoose = require('mongoose');
const Tenant = require('../models/Tenant');
const tenantPool = require('../utils/tenantConnectionPool');

// Extract tenant from request
exports.extractTenant = async (req, res, next) => {
  try {
    let tenantIdentifier;
    
    // Extract from subdomain or custom domain
    const host = req.get('host');
    
    if (host.includes('.')) {
      const parts = host.split('.');
      if (parts.length >= 3) {
        tenantIdentifier = parts[0]; // subdomain
      } else {
        tenantIdentifier = host; // custom domain
      }
    } else {
      tenantIdentifier = host;
    }

    // For development/localhost, extract from header or default
    if (host === 'localhost' || host === '127.0.0.1' || host.startsWith('localhost:') || host.startsWith('127.0.0.1:')) {
      tenantIdentifier = req.headers['x-tenant'] || 'demo';
    }

    req.tenantIdentifier = tenantIdentifier;
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Tenant extraction failed'
    });
  }
};

// Switch to tenant database using connection pool
exports.switchTenantDB = async (req, res, next) => {
  try {
    const { tenantIdentifier } = req;
    
    if (!tenantIdentifier) {
      return res.status(400).json({
        success: false,
        error: { message: 'Tenant identifier required', code: 400 }
      });
    }

    // Find tenant in main database with caching
    const tenant = await Tenant.findOne({
      $or: [
        { subdomain: tenantIdentifier },
        { customDomain: tenantIdentifier }
      ]
    }).lean(); // Use lean for better performance

    if (!tenant) {
      return res.status(404).json({
        success: false,
        error: { message: 'Tenant not found', code: 404 }
      });
    }

    // Enforce tenant status rules
    if (tenant.status === 'suspended') {
      return res.status(403).json({
        success: false,
        error: { message: 'Account suspended. Please contact support.', code: 403 }
      });
    }

    if (tenant.status !== 'active' && tenant.status !== 'trial' && tenant.status !== 'setup_pending') {
      return res.status(403).json({
        success: false,
        error: { message: 'Account not accessible', code: 403 }
      });
    }

    // Get tenant connection from pool
    const tenantConnection = await tenantPool.getConnection(tenant.databaseName);

    req.tenant = tenant;
    req.tenantDB = tenantConnection;
    req.tenantId = tenant._id;
    
    next();
  } catch (error) {
    console.error('Database switching failed:', error);
    res.status(500).json({
      success: false,
      error: { message: 'Service temporarily unavailable', code: 500 }
    });
  }
};

// Get tenant-specific model
exports.getTenantModel = (req, modelName, schema) => {
  if (!req.tenantDB) {
    throw new Error('Tenant database connection not available');
  }
  return req.tenantDB.model(modelName, schema);
};

// Export pool for monitoring
exports.tenantPool = tenantPool;  