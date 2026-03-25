const mongoose = require('mongoose');

const cloudinaryImageSchema = {
  url: String,
  metadata: {
    folder: String,
    format: String,
    resourceType: String,
    publicId: String,
    createdAt: Date
  }
};

const SchoolSettingsSchema = new mongoose.Schema({
  // Basic School Information
  schoolName: {
    type: String,
    required: [true, 'Please add school name'],
    default: 'AI Based School',
    trim: true
  },
  tagline: {
    type: String,
    default: 'Empowering students with knowledge, skills, and values',
    trim: true
  },
  establishedYear: {
    type: Number,
    default: 1995
  },

  // Contact Information
  email: {
    type: String,
    required: [true, 'Please add school email'],
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  phone: {
    type: String,
    required: [true, 'Please add school phone number'],
    trim: true
  },
  address: {
    street: {
      type: String,
      default: '123 Education Street'
    },
    city: {
      type: String,
      default: 'Tando Jam'
    },
    state: {
      type: String,
      default: 'Sindh'
    },
    zipCode: {
      type: String,
      default: '70060'
    },
    country: {
      type: String,
      default: 'Pakistan'
    }
  },

  // Social Media Links
  socialMedia: {
    facebook: {
      type: String,
      default: 'https://facebook.com'
    },
    twitter: {
      type: String,
      default: 'https://twitter.com'
    },
    instagram: {
      type: String,
      default: 'https://instagram.com'
    },
    linkedin: {
      type: String,
      default: 'https://linkedin.com'
    },
    youtube: {
      type: String,
      default: 'https://youtube.com'
    }
  },

  // Footer Settings
  footer: {
    schoolDescription: {
      type: String,
      default: 'Providing quality education and empowering students to become responsible global citizens since 1995.'
    },
    quickLinks: [{
      title: {
        type: String,
        required: true
      },
      url: {
        type: String,
        required: true
      },
      order: {
        type: Number,
        default: 0
      }
    }],
    newsletterEnabled: {
      type: Boolean,
      default: true
    },
    copyrightText: {
      type: String,
      default: 'All rights reserved.'
    }
  },

  // School Hours
  schoolHours: {
    weekdays: {
      type: String,
      default: 'Monday - Friday: 8:00 AM - 3:00 PM'
    },
    weekend: {
      type: String,
      default: 'Saturday: 8:00 AM - 12:00 PM'
    },
    closed: {
      type: String,
      default: 'Sunday: Closed'
    }
  },

  // Landing Page Customization
  landingPage: {
    heroImage: cloudinaryImageSchema,
    heroTitle: {
      type: String,
      default: 'Welcome to Our School'
    },
    heroSubtitle: {
      type: String,
      default: 'Empowering minds, shaping futures'
    },
    stats: {
      studentCount: {
        type: Number,
        default: 0
      },
      teacherCount: {
        type: Number,
        default: 0
      },
      classesCount: {
        type: Number,
        default: 0
      },
      successRate: {
        type: Number,
        default: 95
      }
    },
    featuredTeachers: [{
      teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher'
      },
      image: cloudinaryImageSchema,
      displayOrder: {
        type: Number,
        default: 0
      }
    }],
    testimonials: [{
      name: String,
      role: String,
      image: cloudinaryImageSchema,
      content: String,
      displayOrder: {
        type: Number,
        default: 0
      }
    }]
  },

  aboutPage: {
    bannerImage: cloudinaryImageSchema,
    mainContent: {
      type: String,
      default: 'About our school...'
    },
    principalImage: cloudinaryImageSchema,
    principalMessage: {
      type: String,
      default: 'Message from the principal...'
    },
    viceImage: cloudinaryImageSchema,
    viceMessage: {
      type: String,
      default: 'Message from the vice principal...'
    },
    leadershipTeam: [{
      name: String,
      position: String,
      photo: cloudinaryImageSchema,
      bio: String,
      displayOrder: {
        type: Number,
        default: 0
      }
    }]
  },

  // Last Updated
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Middleware to delete Cloudinary images before removing document
SchoolSettingsSchema.pre('remove', async function(next) {
  try {
    const cloudinary = require('../config/cloudinary');
    const deletePromises = [];

    // Helper function to delete Cloudinary image
    const deleteCloudinaryImage = (image) => {
      if (image?.metadata?.publicId) {
        return cloudinary.uploader.destroy(image.metadata.publicId);
      }
      return Promise.resolve();
    };

    // Delete hero image
    if (this.landingPage?.heroImage) {
      deletePromises.push(deleteCloudinaryImage(this.landingPage.heroImage));
    }

    // Delete featured teacher images
    if (this.landingPage?.featuredTeachers) {
      this.landingPage.featuredTeachers.forEach(teacher => {
        if (teacher.image) {
          deletePromises.push(deleteCloudinaryImage(teacher.image));
        }
      });
    }

    // Delete testimonial images
    if (this.landingPage?.testimonials) {
      this.landingPage.testimonials.forEach(testimonial => {
        if (testimonial.image) {
          deletePromises.push(deleteCloudinaryImage(testimonial.image));
        }
      });
    }

    // Delete about page images
    if (this.aboutPage) {
      if (this.aboutPage.bannerImage) {
        deletePromises.push(deleteCloudinaryImage(this.aboutPage.bannerImage));
      }
      if (this.aboutPage.principalImage) {
        deletePromises.push(deleteCloudinaryImage(this.aboutPage.principalImage));
      }
      if (this.aboutPage.viceImage) {
        deletePromises.push(deleteCloudinaryImage(this.aboutPage.viceImage));
      }
      if (this.aboutPage.leadershipTeam) {
        this.aboutPage.leadershipTeam.forEach(member => {
          if (member.photo) {
            deletePromises.push(deleteCloudinaryImage(member.photo));
          }
        });
      }
    }

    await Promise.all(deletePromises);
    next();
  } catch (error) {
    next(error);
  }
});

// Create a singleton pattern - only one settings document should exist
SchoolSettingsSchema.statics.findOneOrCreate = async function(userId) {
  const settings = await this.findOne();
  if (settings) {
    return settings;
  }

  return this.create({
    updatedBy: userId
  });
};

module.exports = mongoose.model('SchoolSettings', SchoolSettingsSchema);
