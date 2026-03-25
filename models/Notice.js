const mongoose = require('mongoose');

const EventNoticeSchema = new mongoose.Schema({
  tenant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please add a title'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  content: {
    type: String,
    required: [true, 'Please add content'],
    maxlength: [1000, 'Content cannot be more than 1000 characters']
  },
  type: {
    type: String,
    enum: ['notice', 'event'],
    default: 'notice'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  targetAudience: {
    type: [String],
    enum: ['all', 'teachers', 'students', 'parents', 'staff'],
    default: ['all']
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date
  },
  eventTime: {
    type: String,
    trim: true
  },
  location: {
    type: String,
    trim: true,
    maxlength: [200, 'Location cannot be more than 200 characters']
  },
  attachmentFile: {
    type: String,
    trim: true
  },
  attachmentPublicId: {
    type: String,
    trim: true
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

// Set endDate to 30 days from now if not provided
EventNoticeSchema.pre('save', function(next) {
  if (!this.endDate) {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    this.endDate = thirtyDaysFromNow;
  }
  next();
});

module.exports = mongoose.model('EventNotice', EventNoticeSchema);
