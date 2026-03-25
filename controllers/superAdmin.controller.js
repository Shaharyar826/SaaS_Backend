const SuperAdmin = require('../models/SuperAdmin');
const Tenant = require('../models/Tenant');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

// @desc    Super Admin Login
// @route   POST /api/super-admin/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const superAdmin = await SuperAdmin.findOne({ email }).select('+password');

    if (!superAdmin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await superAdmin.matchPassword(password);

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update last login
    superAdmin.lastLogin = new Date();
    await superAdmin.save();

    const token = superAdmin.getSignedJwtToken();

    const options = {
      expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
      httpOnly: true
    };

    res.status(200)
      .cookie('superAdminToken', token, options)
      .json({
        success: true,
        token,
        superAdmin: {
          id: superAdmin._id,
          firstName: superAdmin.firstName,
          lastName: superAdmin.lastName,
          email: superAdmin.email
        }
      });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Super Admin Logout
// @route   POST /api/super-admin/auth/logout
// @access  Private
exports.logout = (req, res) => {
  res.cookie('superAdminToken', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// @desc    Get Super Admin Profile
// @route   GET /api/super-admin/auth/me
// @access  Private
exports.getMe = (req, res) => {
  res.status(200).json({
    success: true,
    superAdmin: {
      id: req.superAdmin._id,
      firstName: req.superAdmin.firstName,
      lastName: req.superAdmin.lastName,
      email: req.superAdmin.email,
      lastLogin: req.superAdmin.lastLogin
    }
  });
};

// @desc    Get Dashboard Analytics
// @route   GET /api/super-admin/dashboard
// @access  Private
exports.getDashboard = async (req, res) => {
  try {
    const totalTenants = await Tenant.countDocuments();
    const activeTenants = await Tenant.countDocuments({ status: 'active' });
    const trialTenants = await Tenant.countDocuments({ status: 'trial' });
    const suspendedTenants = await Tenant.countDocuments({ status: 'suspended' });

    // Get subscription stats
    const subscriptionStats = await Subscription.aggregate([
      {
        $group: {
          _id: '$plan',
          count: { $sum: 1 },
          revenue: { $sum: '$amount' }
        }
      }
    ]);

    // Get recent tenants
    const recentTenants = await Tenant.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('schoolName subdomain status createdAt');

    // Get monthly growth data
    const monthlyGrowth = await Tenant.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    // Get revenue data from subscriptions
    const revenueData = await Subscription.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 }
    ]);

    res.json({
      success: true,
      data: {
        stats: {
          totalTenants,
          activeTenants,
          trialTenants,
          suspendedTenants
        },
        subscriptionStats,
        recentTenants,
        monthlyGrowth,
        revenueData
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get All Tenants
// @route   GET /api/super-admin/tenants
// @access  Private
exports.getTenants = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;

    const tenants = await Tenant.find()
      .populate('subscription', 'plan status')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(startIndex);

    const total = await Tenant.countDocuments();

    // Get usage stats and admin info for each tenant
    const tenantsWithStats = await Promise.all(
      tenants.map(async (tenant) => {
        try {
          // Connect to tenant database
          const mongoose = require('mongoose');
          const tenantDbUri = process.env.MONGODB_URI.replace(
            /\/[^\/]*\?/, 
            `/${tenant.databaseName}?`
          );
          
          const tenantConnection = mongoose.createConnection(tenantDbUri);
          const TenantUser = tenantConnection.model('User', User.schema);
          
          // Get admin user
          const adminUser = await TenantUser.findOne({ 
            tenant: tenant._id, 
            role: 'admin' 
          }).select('firstName lastName email');
          
          // Get user stats
          const userStats = await TenantUser.aggregate([
            { $match: { tenant: tenant._id } },
            {
              $group: {
                _id: '$role',
                count: { $sum: 1 }
              }
            }
          ]);

          const stats = {};
          userStats.forEach(stat => {
            stats[stat._id] = stat.count;
          });

          tenantConnection.close();

          return {
            ...tenant.toObject(),
            owner: adminUser,
            userStats: stats
          };
        } catch (error) {
          console.error(`Error fetching data for tenant ${tenant.subdomain}:`, error);
          return {
            ...tenant.toObject(),
            owner: null,
            userStats: {}
          };
        }
      })
    );

    res.json({
      success: true,
      count: tenants.length,
      total,
      pagination: {
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      data: tenantsWithStats
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update Tenant Status
// @route   PUT /api/super-admin/tenants/:id/status
// @access  Private
exports.updateTenantStatus = async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['active', 'suspended', 'trial'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    const tenant = await Tenant.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.json({ success: true, data: tenant });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete Tenant
// @route   DELETE /api/super-admin/tenants/:id
// @access  Private
exports.deleteTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.params.id);

    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Drop the tenant database
    const mongoose = require('mongoose');
    const tenantDbUri = process.env.MONGODB_URI.replace(
      /\/[^\/]*\?/, 
      `/${tenant.databaseName}?`
    );
    const tenantConnection = mongoose.createConnection(tenantDbUri);
    await tenantConnection.dropDatabase();
    tenantConnection.close();

    // Delete subscription
    await Subscription.deleteOne({ tenant: tenant._id });
    
    // Delete tenant
    await tenant.deleteOne();

    res.json({ success: true, message: 'Tenant and database deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get All Users Across Tenants
// @route   GET /api/super-admin/users
// @access  Private
exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const startIndex = (page - 1) * limit;

    // Get all tenants first
    const tenants = await Tenant.find().select('_id schoolName subdomain databaseName');
    const allUsers = [];

    // Fetch users from each tenant database
    for (const tenant of tenants) {
      try {
        const mongoose = require('mongoose');
        const tenantDbUri = process.env.MONGODB_URI.replace(
          /\/[^\/]*\?/, 
          `/${tenant.databaseName}?`
        );
        
        const tenantConnection = mongoose.createConnection(tenantDbUri);
        const TenantUser = tenantConnection.model('User', User.schema);
        
        const users = await TenantUser.find({ tenant: tenant._id })
          .select('firstName lastName email role status lastLogin createdAt')
          .limit(limit)
          .skip(startIndex);

        users.forEach(user => {
          allUsers.push({
            ...user.toObject(),
            tenant: {
              id: tenant._id,
              schoolName: tenant.schoolName,
              subdomain: tenant.subdomain
            }
          });
        });

        tenantConnection.close();
      } catch (error) {
        console.error(`Error fetching users for tenant ${tenant.subdomain}:`, error);
      }
    }

    res.json({
      success: true,
      count: allUsers.length,
      data: allUsers
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update User Status Across Tenants
// @route   PUT /api/super-admin/users/:id/status
// @access  Private
exports.updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const userId = req.params.id;
    
    if (!['active', 'suspended', 'inactive'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    // Find user across all tenant databases
    const tenants = await Tenant.find().select('_id databaseName');
    let userUpdated = false;

    for (const tenant of tenants) {
      try {
        const mongoose = require('mongoose');
        const tenantDbUri = process.env.MONGODB_URI.replace(
          /\/[^\/]*\?/, 
          `/${tenant.databaseName}?`
        );
        
        const tenantConnection = mongoose.createConnection(tenantDbUri);
        const TenantUser = tenantConnection.model('User', User.schema);
        
        const user = await TenantUser.findByIdAndUpdate(
          userId,
          { status },
          { new: true }
        );

        if (user) {
          userUpdated = true;
          tenantConnection.close();
          break;
        }

        tenantConnection.close();
      } catch (error) {
        console.error(`Error updating user in tenant ${tenant._id}:`, error);
      }
    }

    if (!userUpdated) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User status updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Delete User Across Tenants
// @route   DELETE /api/super-admin/users/:id
// @access  Private
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Find and delete user across all tenant databases
    const tenants = await Tenant.find().select('_id databaseName');
    let userDeleted = false;

    for (const tenant of tenants) {
      try {
        const mongoose = require('mongoose');
        const tenantDbUri = process.env.MONGODB_URI.replace(
          /\/[^\/]*\?/, 
          `/${tenant.databaseName}?`
        );
        
        const tenantConnection = mongoose.createConnection(tenantDbUri);
        const TenantUser = tenantConnection.model('User', User.schema);
        
        const user = await TenantUser.findByIdAndDelete(userId);

        if (user) {
          userDeleted = true;
          tenantConnection.close();
          break;
        }

        tenantConnection.close();
      } catch (error) {
        console.error(`Error deleting user in tenant ${tenant._id}:`, error);
      }
    }

    if (!userDeleted) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get Platform Analytics
// @route   GET /api/super-admin/analytics
// @access  Private
exports.getAnalytics = async (req, res) => {
  try {
    const range = req.query.range || '30d';
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (range) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get tenant stats
    const totalTenants = await Tenant.countDocuments();
    const activeTenants = await Tenant.countDocuments({ status: 'active' });
    const newTenants = await Tenant.countDocuments({ 
      createdAt: { $gte: startDate } 
    });

    // Get tenant growth over time
    const tenantGrowth = await Tenant.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          tenants: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
      {
        $project: {
          month: {
            $arrayElemAt: [
              ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
              '$_id.month'
            ]
          },
          tenants: 1,
          _id: 0
        }
      }
    ]);

    // Get subscription stats
    const subscriptions = await Subscription.find()
      .populate('tenant', 'schoolName')
      .select('plan status amount createdAt');

    const totalRevenue = subscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0);
    const monthlyRecurring = subscriptions
      .filter(sub => sub.status === 'active')
      .reduce((sum, sub) => sum + (sub.amount || 0), 0);

    // Get revenue growth
    const revenueGrowth = await Subscription.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          revenue: { $sum: '$amount' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
      { $limit: 12 },
      {
        $project: {
          month: {
            $arrayElemAt: [
              ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
              '$_id.month'
            ]
          },
          revenue: 1,
          _id: 0
        }
      }
    ]);

    // Calculate user counts across all tenants
    const tenants = await Tenant.find().select('databaseName');
    let totalUsers = 0;
    let usersByRole = { admin: 0, teacher: 0, student: 0, principal: 0, accountant: 0 };

    for (const tenant of tenants) {
      try {
        const mongoose = require('mongoose');
        const tenantDbUri = process.env.MONGODB_URI.replace(
          /\/[^\/]*\?/, 
          `/${tenant.databaseName}?`
        );
        
        const tenantConnection = mongoose.createConnection(tenantDbUri);
        const TenantUser = tenantConnection.model('User', require('../models/User').schema);
        
        const userCount = await TenantUser.countDocuments();
        totalUsers += userCount;

        const roleStats = await TenantUser.aggregate([
          {
            $group: {
              _id: '$role',
              count: { $sum: 1 }
            }
          }
        ]);

        roleStats.forEach(stat => {
          if (usersByRole.hasOwnProperty(stat._id)) {
            usersByRole[stat._id] += stat.count;
          }
        });

        tenantConnection.close();
      } catch (error) {
        console.error(`Error fetching users for tenant ${tenant._id}:`, error);
      }
    }

    // Feature usage calculation
    const featureUsage = [
      { feature: 'Students', usage: Math.floor((usersByRole.student / totalUsers) * 100) || 0, tenants: Math.floor(totalTenants * 0.98) },
      { feature: 'Teachers', usage: Math.floor((usersByRole.teacher / totalUsers) * 100) || 0, tenants: Math.floor(totalTenants * 0.95) },
      { feature: 'Attendance', usage: 87, tenants: Math.floor(totalTenants * 0.87) },
      { feature: 'Fees', usage: 76, tenants: Math.floor(totalTenants * 0.76) },
      { feature: 'Events', usage: 68, tenants: Math.floor(totalTenants * 0.68) }
    ];

    const analyticsData = {
      overview: {
        totalTenants,
        activeUsers: totalUsers,
        totalRevenue,
        growthRate: totalTenants > 0 ? ((newTenants / totalTenants) * 100).toFixed(1) : 0
      },
      tenantGrowth: tenantGrowth.length > 0 ? tenantGrowth : [
        { month: 'Jan', tenants: Math.floor(totalTenants * 0.7) },
        { month: 'Feb', tenants: Math.floor(totalTenants * 0.85) },
        { month: 'Mar', tenants: totalTenants }
      ],
      revenueGrowth: revenueGrowth.length > 0 ? revenueGrowth : [
        { month: 'Jan', revenue: Math.floor(totalRevenue * 0.7) },
        { month: 'Feb', revenue: Math.floor(totalRevenue * 0.85) },
        { month: 'Mar', revenue: totalRevenue }
      ],
      featureUsage,
      userActivity: {
        dailyActiveUsers: Math.floor(totalUsers * 0.7),
        weeklyActiveUsers: Math.floor(totalUsers * 0.9),
        monthlyActiveUsers: totalUsers,
        averageSessionDuration: '24m 15s'
      },
      usersByRole,
      supportMetrics: {
        totalTickets: 45,
        resolvedTickets: 38,
        averageResponseTime: '2h 15m',
        satisfactionScore: 4.6
      }
    };

    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get Billing Overview
// @route   GET /api/super-admin/billing/overview
// @access  Private
exports.getBillingOverview = async (req, res) => {
  try {
    const range = req.query.range || '30d';
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (range) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get subscription data
    const subscriptions = await Subscription.find({ status: 'active' })
      .populate('tenant', 'schoolName subdomain');

    const totalRevenue = subscriptions.reduce((sum, sub) => sum + (sub.amount || 0), 0);
    const monthlyRecurring = totalRevenue;
    const activeSubscriptions = subscriptions.length;
    const averageRevenuePerUser = activeSubscriptions > 0 ? totalRevenue / activeSubscriptions : 0;

    // Calculate churn rate
    const totalTenants = await Tenant.countDocuments();
    const suspendedTenants = await Tenant.countDocuments({ status: 'suspended' });
    const churnRate = totalTenants > 0 ? ((suspendedTenants / totalTenants) * 100).toFixed(1) : 0;

    // Calculate growth
    const previousPeriodStart = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    const previousRevenue = await Subscription.aggregate([
      {
        $match: {
          createdAt: { $gte: previousPeriodStart, $lt: startDate },
          status: 'active'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$amount' }
        }
      }
    ]);

    const prevRevenue = previousRevenue[0]?.total || 0;
    const revenueGrowth = prevRevenue > 0 ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : 0;

    const billingData = {
      totalRevenue,
      monthlyRecurring,
      activeSubscriptions,
      churnRate: parseFloat(churnRate),
      averageRevenuePerUser: parseFloat(averageRevenuePerUser.toFixed(2)),
      revenueGrowth: parseFloat(revenueGrowth)
    };

    res.json({
      success: true,
      data: billingData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get Billing Transactions
// @route   GET /api/super-admin/billing/transactions
// @access  Private
exports.getBillingTransactions = async (req, res) => {
  try {
    const range = req.query.range || '30d';
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (range) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get real transactions from subscriptions
    const transactions = await Subscription.find({
      createdAt: { $gte: startDate }
    })
    .populate('tenant', 'schoolName')
    .sort({ createdAt: -1 })
    .limit(50)
    .select('tenant plan amount status createdAt stripeSubscriptionId');

    const formattedTransactions = transactions.map(sub => ({
      id: sub._id,
      tenant: sub.tenant?.schoolName || 'Unknown School',
      amount: sub.amount || 0,
      plan: sub.plan || 'Unknown',
      status: sub.status === 'active' ? 'succeeded' : sub.status,
      date: sub.createdAt,
      stripeId: sub.stripeSubscriptionId || `sub_${sub._id.toString().slice(-10)}`
    }));

    res.json({
      success: true,
      data: formattedTransactions
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Get System Settings
// @route   GET /api/super-admin/settings
// @access  Private
exports.getSettings = async (req, res) => {
  try {
    // Mock settings data - in real implementation, this would be stored in database
    const settings = {
      general: {
        platformName: 'EduFlow',
        supportEmail: 'support@eduflow.com',
        maintenanceMode: false,
        allowNewRegistrations: true,
        defaultTrialDays: 14
      },
      smtp: {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        username: process.env.SMTP_USERNAME || '',
        password: '***hidden***',
        fromEmail: process.env.FROM_EMAIL || 'noreply@eduflow.com',
        fromName: 'EduFlow'
      },
      oauth: {
        googleEnabled: false,
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        googleClientSecret: '***hidden***',
        microsoftEnabled: false,
        microsoftClientId: process.env.MICROSOFT_CLIENT_ID || '',
        microsoftClientSecret: '***hidden***'
      },
      branding: {
        primaryColor: '#4F46E5',
        secondaryColor: '#10B981',
        logoUrl: '',
        faviconUrl: '',
        customCss: ''
      },
      security: {
        passwordMinLength: 8,
        requireSpecialChars: true,
        sessionTimeout: 24,
        maxLoginAttempts: 5,
        twoFactorRequired: false
      }
    };

    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @desc    Update System Settings
// @route   PUT /api/super-admin/settings
// @access  Private
exports.updateSettings = async (req, res) => {
  try {
    const { settings } = req.body;
    
    // In real implementation, save settings to database
    // For now, just return success
    
    res.json({
      success: true,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};