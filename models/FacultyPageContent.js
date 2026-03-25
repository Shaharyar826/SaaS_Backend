const mongoose = require('mongoose');

const FacultyPageContentSchema = new mongoose.Schema({
  departments: [
    {
      name: {
        type: String,
        required: true,
        trim: true
      },
      description: {
        type: String,
        trim: true,
        default: ''
      }
    }
  ],
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('FacultyPageContent', FacultyPageContentSchema);
