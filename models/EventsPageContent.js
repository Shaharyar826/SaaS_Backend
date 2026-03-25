const mongoose = require('mongoose');

const EventsPageEventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  time: { type: String },
  location: { type: String },
  description: { type: String, required: true, trim: true },
  image: { type: String, default: null },
  category: { type: String, default: 'General' },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
});

const EventsPageNewsSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  date: { type: Date, required: true },
  summary: { type: String, required: true, trim: true },
  image: { type: String, default: null },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
});

const EventsPageCalendarItemSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  date: { type: String, required: true }, // e.g. 'Aug 15', 'Dec 1-10'
  description: { type: String, required: true, trim: true },
  semester: { type: String, enum: ['First', 'Second'], required: true },
  displayOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true }
});

const EventsPageContentSchema = new mongoose.Schema({
  events: [EventsPageEventSchema],
  news: [EventsPageNewsSchema],
  calendar: [EventsPageCalendarItemSchema],
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('EventsPageContent', EventsPageContentSchema); 