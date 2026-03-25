const mongoose = require('mongoose');

const LandingPageEventSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please add event title'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'Please add event date']
  },
  description: {
    type: String,
    required: [true, 'Please add event description'],
    trim: true
  },
  image: {
    type: String,
    default: null
  },
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LandingPageEvent', LandingPageEventSchema);
