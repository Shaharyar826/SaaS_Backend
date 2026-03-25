const mongoose = require('mongoose');

const AboutUsContentSchema = new mongoose.Schema({
  // Main content
  mainContent: {
    type: String,
    required: [true, 'Please add main content'],
    trim: true
  },

  // Banner image
  bannerImage: {
    type: String,
    default: null
  },

  // Vision section
  vision: {
    title: {
      type: String,
      default: 'Our Vision',
      trim: true
    },
    content: {
      type: String,
      required: [true, 'Please add vision content'],
      trim: true
    }
  },

  // Mission section
  mission: {
    title: {
      type: String,
      default: 'Our Mission',
      trim: true
    },
    content: {
      type: String,
      required: [true, 'Please add mission content'],
      trim: true
    }
  },

  // Leadership section
  leadership: {
    title: {
      type: String,
      default: 'Our Leadership',
      trim: true
    },
    description: {
      type: String,
      default: 'Our school is led by a team of dedicated educators and administrators who are committed to maintaining high standards of education and fostering a positive learning environment.',
      trim: true
    },
    team: [
      {
        name: {
          type: String,
          trim: true
        },
        position: {
          type: String,
          trim: true
        },
        photo: {
          type: String,
          default: null
        },
        description: {
          type: String,
          trim: true
        }
      }
    ]
  },

  // Values section
  values: {
    title: {
      type: String,
      default: 'Our Values',
      trim: true
    },
    items: [
      {
        title: {
          type: String,
          trim: true
        },
        description: {
          type: String,
          trim: true
        },
        icon: {
          type: String,
          default: null
        }
      }
    ]
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
AboutUsContentSchema.statics.findOneOrCreate = async function(userId) {
  const content = await this.findOne();
  if (content) {
    return content;
  }

  return this.create({
    mainContent: 'AI Based School was established in 1995 with a vision to provide quality education to the students of Tando Jam and surrounding areas.',
    vision: {
      title: 'Our Vision',
      content: 'To be a leading educational institution that nurtures academic excellence, personal growth, and social responsibility.'
    },
    mission: {
      title: 'Our Mission',
      content: 'To provide a supportive and challenging learning environment that empowers students to become critical thinkers, lifelong learners, and responsible citizens.'
    },
    leadership: {
      title: 'Our Leadership',
      description: 'Our school is led by a team of dedicated educators and administrators who are committed to maintaining high standards of education and fostering a positive learning environment. The leadership team works collaboratively to ensure that the school continues to evolve and improve while staying true to its core values.',
      team: [
        {
          name: 'John Smith',
          position: 'School Principal',
          photo: null,
          description: 'With years of experience in education, our principal leads the institution with vision and dedication.'
        },
        {
          name: 'Jane Doe',
          position: 'Vice Principal',
          photo: null,
          description: 'Our vice principal oversees academic programs and ensures that our curriculum meets the highest standards.'
        }
      ]
    },
    values: {
      title: 'Our Values',
      items: [
        {
          title: 'Excellence',
          description: 'We strive for excellence in all aspects of education and personal development.',
          icon: null
        },
        {
          title: 'Integrity',
          description: 'We uphold the highest standards of honesty, ethics, and responsibility.',
          icon: null
        },
        {
          title: 'Innovation',
          description: 'We embrace creativity, critical thinking, and innovative approaches to learning.',
          icon: null
        }
      ]
    },
    updatedBy: userId
  });
};

module.exports = mongoose.model('AboutUsContent', AboutUsContentSchema);
