const mongoose = require('mongoose');

const GalleryImageSchema = new mongoose.Schema({
  // Image title
  title: {
    type: String,
    required: [true, 'Please add image title'],
    trim: true
  },

  // Image URL from Cloudinary
  imageUrl: {
    type: String,
    required: [true, 'Image URL is required']
  },

  // Cloudinary metadata
  imageMetadata: {
    folder: String,
    format: String,
    resourceType: String,
    publicId: String,
    createdAt: Date
  },

  // Event tag
  eventTag: {
    type: String,
    trim: true
  },

  // Image date
  date: {
    type: Date,
    default: Date.now
  },

  // Description
  description: {
    type: String,
    trim: true
  },

  // Display order
  displayOrder: {
    type: Number,
    default: 0
  },

  // Is active
  isActive: {
    type: Boolean,
    default: true
  },

  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Middleware to delete image from Cloudinary before removing document
// Note: This won't be triggered by Model.deleteOne() directly, only by document.deleteOne()
GalleryImageSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    if (this.imageMetadata && this.imageMetadata.publicId) {
      const cloudinary = require('../config/cloudinary');
      await cloudinary.uploader.destroy(this.imageMetadata.publicId);
    }
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('GalleryImage', GalleryImageSchema);
