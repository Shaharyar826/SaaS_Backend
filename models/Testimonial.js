const mongoose = require('mongoose');

const TestimonialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add name'],
    trim: true
  },
  role: {
    type: String,
    required: [true, 'Please add role (e.g., Parent, Student)'],
    trim: true
  },
  quote: {
    type: String,
    required: [true, 'Please add testimonial quote'],
    trim: true
  },
  image: {
    type: String,
    default: 'default-avatar.jpg'
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

module.exports = mongoose.model('Testimonial', TestimonialSchema);
