const express = require('express');
const {
  getMeetings,
  getMeeting,
  createMeeting,
  updateMeeting,
  deleteMeeting,
  cancelMeeting,
  getMyMeetings
} = require('../controllers/meeting.controller');

const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Protected routes
router.get('/my-meetings', protect, getMyMeetings);
router.get('/', protect, getMeetings);
router.get('/:id', protect, getMeeting);

// Admin/Principal only routes
router.post('/', protect, authorize('admin', 'principal'), createMeeting);
router.put('/:id', protect, authorize('admin', 'principal'), updateMeeting);
router.put('/:id/cancel', protect, authorize('admin', 'principal'), cancelMeeting);
router.delete('/:id', protect, authorize('admin', 'principal'), deleteMeeting);

module.exports = router;
