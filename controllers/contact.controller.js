const ContactMessage = require('../models/ContactMessage');
const User = require('../models/User');
const Notification = require('../models/Notification');

// @desc    Get unread contact message count
// @route   GET /api/contact/unread-count
// @access  Private/Admin,Principal
exports.getUnreadCount = async (req, res) => {
  try {
    console.log('Fetching unread contact message count');

    const count = await ContactMessage.countDocuments({
      isRead: false,
      status: 'new'
    });

    console.log('Unread contact message count:', count);

    res.status(200).json({
      success: true,
      count
    });
  } catch (err) {
    console.error('Error getting unread count:', err);
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// Helper function to create contact message notifications for admin and principal users
const createContactNotifications = async (contactMessage) => {
  try {
    console.log('Creating contact message notifications');

    // Find admin and principal users
    const users = await User.find({
      role: { $in: ['admin', 'principal'] },
      isApproved: true,
      status: 'active'
    });

    console.log(`Found ${users.length} admin/principal users to notify`);

    if (users.length === 0) {
      console.log('No admin/principal users found to create notifications for');
      return;
    }

    // Create notification for each admin/principal user
    const notifications = users.map(user => ({
      user: user._id,
      type: 'contact',
      title: 'New Contact Message',
      message: `${contactMessage.name} sent a message: ${contactMessage.subject}`,
      relatedEntity: {
        entityType: 'ContactMessage',
        entityId: contactMessage._id
      },
      priority: 'medium',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    }));

    const result = await Notification.insertMany(notifications);
    console.log(`Successfully created ${result.length} contact notifications`);

    return result;
  } catch (error) {
    console.error('Error creating contact notifications:', error);
    // Don't throw the error, just log it
  }
};

// @desc    Submit contact form message
// @route   POST /api/contact
// @access  Public
exports.submitContactMessage = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields'
      });
    }

    // Create contact message
    const contactMessage = await ContactMessage.create({
      name,
      email,
      subject,
      message
    });

    console.log('New contact message saved:', contactMessage._id);

    res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully. We will get back to you soon.',
      data: contactMessage
    });
  } catch (err) {
    console.error('Error in submitContactMessage:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to send message',
      error: err.message
    });
  }
};

// @desc    Get all contact messages
// @route   GET /api/contact
// @access  Private/Admin,Principal
exports.getContactMessages = async (req, res) => {
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
    query = ContactMessage.find(JSON.parse(queryStr));

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
      query = query.sort('-createdAt'); // Default sort by newest first
    }

    // Pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const total = await ContactMessage.countDocuments(JSON.parse(queryStr));

    query = query.skip(startIndex).limit(limit);

    // Execute query
    const contactMessages = await query;

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
      count: contactMessages.length,
      pagination,
      total,
      data: contactMessages
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Get single contact message
// @route   GET /api/contact/:id
// @access  Private/Admin,Principal
exports.getContactMessage = async (req, res) => {
  try {
    const contactMessage = await ContactMessage.findById(req.params.id);

    if (!contactMessage) {
      return res.status(404).json({
        success: false,
        message: `No contact message found with id ${req.params.id}`
      });
    }

    res.status(200).json({
      success: true,
      data: contactMessage
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Mark contact message as read
// @route   PUT /api/contact/:id/read
// @access  Private/Admin,Principal
exports.markAsRead = async (req, res) => {
  try {
    const contactMessage = await ContactMessage.findById(req.params.id);

    if (!contactMessage) {
      return res.status(404).json({
        success: false,
        message: `No contact message found with id ${req.params.id}`
      });
    }

    contactMessage.isRead = true;
    contactMessage.status = 'read';
    await contactMessage.save();

    res.status(200).json({
      success: true,
      data: contactMessage
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message
    });
  }
};

// @desc    Delete contact message
// @route   DELETE /api/contact/:id
// @access  Private/Admin,Principal
exports.deleteContactMessage = async (req, res) => {
  try {
    const contactMessage = await ContactMessage.findById(req.params.id);

    if (!contactMessage) {
      return res.status(404).json({
        success: false,
        message: `No contact message found with id ${req.params.id}`
      });
    }

    await contactMessage.deleteOne();

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
