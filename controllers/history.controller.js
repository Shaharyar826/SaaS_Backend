const History = require('../models/History');
const Meeting = require('../models/Meeting');
const EventNotice = require('../models/Notice');

// @desc    Get history records
// @route   GET /api/history
// @access  Private/Admin,Principal
exports.getHistory = async (req, res) => {
  try {
    // Build query
    let query;

    // Copy req.query
    const reqQuery = { ...req.query };

    // Fields to exclude
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Loop over removeFields and delete them from reqQuery
    removeFields.forEach(param => delete reqQuery[param]);

    // Create query string
    let queryStr = JSON.stringify(reqQuery);

    // Create operators ($gt, $gte, etc)
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

    // Finding resource
    query = History.find(JSON.parse(queryStr))
      .populate({
        path: 'performedBy',
        select: 'name role'
      });

    // Select fields
    if (req.query.select) {
      const fields = req.query.select.split(',').join(' ');
      query = query.select(fields);
    }

    // Sort
    if (req.query.sort) {
      const sortBy = req.query.sort.split(',').join(' ');
      query = query.sort(sortBy);
    } else {
      query = query.sort('-createdAt');
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await History.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const history = await query;

    // Pagination result
    const pagination = {};

    if (endIndex < total) {
      pagination.next = {
        page: page + 1,
        limit
      };
    }

    if (startIndex > 0) {
      pagination.prev = {
        page: page - 1,
        limit
      };
    }

    res.status(200).json({
      success: true,
      count: history.length,
      pagination,
      data: history
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get history for a specific entity
// @route   GET /api/history/:entityType/:entityId
// @access  Private/Admin,Principal
exports.getEntityHistory = async (req, res) => {
  try {
    const { entityType, entityId } = req.params;

    // Validate entity type
    if (!['Meeting', 'EventNotice', 'FeaturedTeacher', 'LandingPageEvent', 'Testimonial', 'GalleryImage'].includes(entityType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid entity type'
      });
    }

    // Check if entity exists
    let entity;
    if (entityType === 'Meeting') {
      entity = await Meeting.findById(entityId);
    } else if (entityType === 'EventNotice') {
      entity = await EventNotice.findById(entityId);
    } else if (entityType === 'FeaturedTeacher') {
      const FeaturedTeacher = require('../models/FeaturedTeacher');
      entity = await FeaturedTeacher.findById(entityId);
    } else if (entityType === 'LandingPageEvent') {
      const LandingPageEvent = require('../models/LandingPageEvent');
      entity = await LandingPageEvent.findById(entityId);
    } else if (entityType === 'Testimonial') {
      const Testimonial = require('../models/Testimonial');
      entity = await Testimonial.findById(entityId);
    }

    if (!entity) {
      return res.status(404).json({
        success: false,
        message: `${entityType} not found`
      });
    }

    // Get history records
    const history = await History.find({
      entityType,
      entityId
    })
    .sort('-createdAt')
    .populate({
      path: 'performedBy',
      select: 'name role'
    });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get history summary
// @route   GET /api/history/summary
// @access  Private/Admin,Principal
exports.getHistorySummary = async (req, res) => {
  try {
    // Get counts by entity type and action
    const summary = await History.aggregate([
      {
        $group: {
          _id: {
            entityType: '$entityType',
            action: '$action'
          },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.entityType',
          actions: {
            $push: {
              action: '$_id.action',
              count: '$count'
            }
          },
          totalCount: { $sum: '$count' }
        }
      },
      {
        $project: {
          _id: 0,
          entityType: '$_id',
          actions: 1,
          totalCount: 1
        }
      }
    ]);

    // Get recent activity
    const recentActivity = await History.find()
      .sort('-createdAt')
      .limit(10)
      .populate({
        path: 'performedBy',
        select: 'name role'
      });

    res.status(200).json({
      success: true,
      data: {
        summary,
        recentActivity
      }
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
