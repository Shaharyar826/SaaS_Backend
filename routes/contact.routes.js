const express = require('express');
const {
  submitContactMessage,
  getContactMessages,
  getContactMessage,
  markAsRead,
  deleteContactMessage,
  getUnreadCount
} = require('../controllers/contact.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Public route for submitting contact form
router.post('/', submitContactMessage);

// Protected routes - Admin/Principal only
router.get(
  '/',
  protect,
  authorize('admin', 'principal'),
  getContactMessages
);

router.get(
  '/unread-count',
  protect,
  authorize('admin', 'principal'),
  getUnreadCount
);

router.get(
  '/:id',
  protect,
  authorize('admin', 'principal'),
  getContactMessage
);

router.put(
  '/:id/read',
  protect,
  authorize('admin', 'principal'),
  markAsRead
);

router.delete(
  '/:id',
  protect,
  authorize('admin', 'principal'),
  deleteContactMessage
);

module.exports = router;
