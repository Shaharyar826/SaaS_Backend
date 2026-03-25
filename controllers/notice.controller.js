const EventNotice = require('../models/Notice');
const fs = require('fs');
const path = require('path');
const { createEventNoticeNotifications } = require('../utils/notificationHelpers');
const { trackCreation, trackUpdate, trackDeletion } = require('../utils/historyHelpers');

// @desc    Get all events and notices
// @route   GET /api/events-notices
// @access  Public
exports.getNotices = async (req, res) => {
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
    query = EventNotice.find(JSON.parse(queryStr))
      .populate({
        path: 'createdBy',
        select: 'name role'
      });

    // Select Fields
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
    const total = await EventNotice.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Executing query
    const notices = await query;

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
      count: notices.length,
      pagination,
      data: notices
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single event or notice
// @route   GET /api/events-notices/:id
// @access  Public
exports.getNotice = async (req, res) => {
  try {
    const notice = await EventNotice.findById(req.params.id).populate({
      path: 'createdBy',
      select: 'name role'
    });

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: `No notice found with id ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: notice
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Create event or notice
// @route   POST /api/events-notices
// @access  Private/Admin,Principal
exports.createNotice = async (req, res) => {
  try {
    // Add user to req.body
    req.body.createdBy = req.user.id;

    // If there's a file uploaded via Cloudinary, add the URL to the request body
    if (req.cloudinaryUrl) {
      req.body.attachmentFile = req.cloudinaryUrl;
      req.body.attachmentPublicId = req.cloudinaryPublicId;
    }

    const notice = await EventNotice.create(req.body);

    // Create notifications for targeted users
    try {
      await createEventNoticeNotifications(notice, req.user.id);
    } catch (notificationError) {
      console.error('Error creating notifications, but event/notice was created:', notificationError);
      // Continue with the response even if notifications fail
    }

    // Track event/notice creation in history
    try {
      await trackCreation('EventNotice', notice, req.user.id, `${notice.type === 'event' ? 'Event' : 'Notice'} created`);
    } catch (historyError) {
      console.error('Error tracking event/notice creation history:', historyError);
      // Continue with the response even if history tracking fails
    }

    res.status(201).json({
      success: true,
      data: notice
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Update event or notice
// @route   PUT /api/events-notices/:id
// @access  Private/Admin,Principal
exports.updateNotice = async (req, res) => {
  try {
    let notice = await EventNotice.findById(req.params.id);

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: `No notice found with id ${req.params.id}`
      });
    }

    // Make sure user is the notice creator or an admin/principal
    if (
      notice.createdBy.toString() !== req.user.id &&
      req.user.role !== 'admin' &&
      req.user.role !== 'principal'
    ) {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to update this notice`
      });
    }

    // If there's a file uploaded via Cloudinary, handle the update
    if (req.cloudinaryUrl) {
      // If there's an existing attachment with public_id, delete it from Cloudinary
      if (notice.attachmentPublicId) {
        try {
          const { deleteImage } = require('../middleware/uploadMiddleware');
          await deleteImage(notice.attachmentPublicId);
        } catch (deleteError) {
          console.error('Error deleting old image from Cloudinary:', deleteError);
          // Continue with the update even if deletion fails
        }
      }
      req.body.attachmentFile = req.cloudinaryUrl;
      req.body.attachmentPublicId = req.cloudinaryPublicId;
    }

    // Remove createdBy from request body to prevent updating it
    delete req.body.createdBy;

    // Store the previous state for history tracking
    const previousState = { ...notice.toObject() };

    notice = await EventNotice.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    // Track event/notice update in history
    try {
      await trackUpdate('EventNotice', previousState, notice, req.user.id, `${notice.type === 'event' ? 'Event' : 'Notice'} updated`);
    } catch (historyError) {
      console.error('Error tracking event/notice update history:', historyError);
      // Continue with the response even if history tracking fails
    }

    res.status(200).json({
      success: true,
      data: notice
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete event or notice
// @route   DELETE /api/events-notices/:id
// @access  Private/Admin,Principal
exports.deleteNotice = async (req, res) => {
  try {
    const notice = await EventNotice.findById(req.params.id);

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: `No notice found with id ${req.params.id}`
      });
    }

    // Make sure user is the notice creator or an admin/principal
    if (
      notice.createdBy.toString() !== req.user.id &&
      req.user.role !== 'admin' &&
      req.user.role !== 'principal'
    ) {
      return res.status(401).json({
        success: false,
        message: `User ${req.user.id} is not authorized to delete this notice`
      });
    }

    // If there's an attachment, delete it from Cloudinary
    if (notice.attachmentPublicId) {
      try {
        const { deleteImage } = require('../middleware/uploadMiddleware');
        await deleteImage(notice.attachmentPublicId);
      } catch (deleteError) {
        console.error('Error deleting image from Cloudinary:', deleteError);
        // Continue with the deletion even if Cloudinary deletion fails
      }
    }

    // Track event/notice deletion in history before deleting
    try {
      await trackDeletion('EventNotice', notice, req.user.id, `${notice.type === 'event' ? 'Event' : 'Notice'} deleted`);
    } catch (historyError) {
      console.error('Error tracking event/notice deletion history:', historyError);
      // Continue with the deletion even if history tracking fails
    }

    await notice.deleteOne();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};
