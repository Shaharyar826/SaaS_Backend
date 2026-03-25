const express = require('express');
const { getEventsPageContent, updateEventsPageContent, updateEventsPageSection, uploadEventsPageImage } = require('../controllers/eventsPageContent.controller');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/eventsPageContentUpload');

const router = express.Router();

// Public: Get all events page content
router.get('/', getEventsPageContent);

// Admin/Principal: Replace all content
router.put('/', protect, authorize('admin', 'principal'), updateEventsPageContent);

// Admin/Principal: Update a section (events, news, calendar)
router.patch('/section', protect, authorize('admin', 'principal'), updateEventsPageSection);

// Admin/Principal: Upload image for events/news
router.post('/upload-image', protect, authorize('admin', 'principal'), upload.single('image'), uploadEventsPageImage);

module.exports = router; 