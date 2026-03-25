const mongoose = require('mongoose');

const HistorySchema = new mongoose.Schema({
  // Entity type (Meeting, EventNotice, FeaturedTeacher, LandingPageEvent, Testimonial, GalleryImage)
  entityType: {
    type: String,
    required: [true, 'Please specify entity type'],
    enum: ['Meeting', 'EventNotice', 'FeaturedTeacher', 'LandingPageEvent', 'Testimonial', 'GalleryImage', 'AboutUsContent', 'AdmissionsContent', 'AcademicsContent', 'FacultyContent']
  },

  // Reference to the entity
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'Please provide entity ID'],
    refPath: 'entityType'
  },

  // Action performed (create, update, delete, cancel)
  action: {
    type: String,
    required: [true, 'Please specify action'],
    enum: ['create', 'update', 'delete', 'cancel']
  },

  // User who performed the action
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Please provide user ID who performed the action']
  },

  // Previous state (for updates)
  previousState: {
    type: mongoose.Schema.Types.Mixed
  },

  // New state (for creates and updates)
  newState: {
    type: mongoose.Schema.Types.Mixed
  },

  // Changes made (for updates)
  changes: [{
    field: String,
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed
  }],

  // Additional information
  description: {
    type: String
  }
}, {
  timestamps: true
});

// Index for faster queries
HistorySchema.index({ entityType: 1, entityId: 1 });
HistorySchema.index({ performedBy: 1 });
HistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model('History', HistorySchema);
