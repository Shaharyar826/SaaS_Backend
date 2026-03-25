const mongoose = require('mongoose');

const AcademicsContentSchema = new mongoose.Schema({
  // Main content
  mainContent: {
    type: String,
    required: [true, 'Please add main content'],
    trim: true
  },
  
  // Curriculum section
  curriculum: {
    title: {
      type: String,
      default: 'Our Curriculum',
      trim: true
    },
    content: {
      type: String,
      required: [true, 'Please add curriculum content'],
      trim: true
    }
  },
  
  // Subjects offered
  subjectsOffered: {
    title: {
      type: String,
      default: 'Subjects Offered',
      trim: true
    },
    content: {
      type: String,
      required: [true, 'Please add subjects offered content'],
      trim: true
    }
  },
  
  // Academic calendar
  academicCalendar: {
    title: {
      type: String,
      default: 'Academic Calendar',
      trim: true
    },
    content: {
      type: String,
      required: [true, 'Please add academic calendar content'],
      trim: true
    }
  },
  
  // Last updated by
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Create a singleton pattern - only one document should exist
AcademicsContentSchema.statics.findOneOrCreate = async function(userId) {
  const content = await this.findOne();
  if (content) {
    return content;
  }
  
  return this.create({ 
    mainContent: 'At AI Based School, we provide a comprehensive and balanced education that prepares students for academic success and personal growth.',
    curriculum: {
      title: 'Our Curriculum',
      content: 'Our curriculum is designed to meet national standards while incorporating innovative teaching methods that engage students in active learning.'
    },
    subjectsOffered: {
      title: 'Subjects Offered',
      content: 'We offer a wide range of subjects including Mathematics, Science, English, Social Studies, Computer Science, Arts, and Physical Education.'
    },
    academicCalendar: {
      title: 'Academic Calendar',
      content: 'Our academic year runs from August to June, with two semesters and regular assessment periods throughout the year.'
    },
    updatedBy: userId 
  });
};

module.exports = mongoose.model('AcademicsContent', AcademicsContentSchema);
