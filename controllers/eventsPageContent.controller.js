const EventsPageContent = require('../models/EventsPageContent');
const cloudinary = require('../config/cloudinary');

// Get all Events Page Content
exports.getEventsPageContent = async (req, res) => {
  try {
    let content = await EventsPageContent.findOne();
    if (!content) {
      content = await EventsPageContent.create({ events: [], news: [], calendar: [] });
    }
    res.status(200).json({ success: true, data: content });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Replace all Events Page Content (admin)
exports.updateEventsPageContent = async (req, res) => {
  try {
    let content = await EventsPageContent.findOne();
    if (!content) {
      content = await EventsPageContent.create({ events: [], news: [], calendar: [] });
    }
    content.events = req.body.events || content.events;
    content.news = req.body.news || content.news;
    content.calendar = req.body.calendar || content.calendar;
    content.updatedAt = Date.now();
    await content.save();
    res.status(200).json({ success: true, data: content });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Add/Update/Delete a single event/news/calendar item (admin, partial update)
exports.updateEventsPageSection = async (req, res) => {
  try {
    let content = await EventsPageContent.findOne();
    if (!content) {
      content = await EventsPageContent.create({ events: [], news: [], calendar: [] });
    }
    const { section, items } = req.body; // section: 'events' | 'news' | 'calendar', items: array
    if (!['events', 'news', 'calendar'].includes(section)) {
      return res.status(400).json({ success: false, message: 'Invalid section' });
    }
    content[section] = items;
    content.updatedAt = Date.now();
    await content.save();
    res.status(200).json({ success: true, data: content });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

exports.uploadEventsPageImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Convert the buffer to base64
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    let dataURI = 'data:' + req.file.mimetype + ';base64,' + b64;

    // Upload to cloudinary
    const result = await cloudinary.uploader.upload(dataURI, {
      folder: 'events-page-content',
      resource_type: 'auto'
    });

    return res.status(200).json({ success: true, url: result.secure_url });
  } catch (err) {
    console.error('Error uploading image:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}; 