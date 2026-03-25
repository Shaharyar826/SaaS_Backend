const mongoose = require('mongoose');

const AdmissionsContentSchema = new mongoose.Schema({
  // Title
  title: {
    type: String,
    required: [true, 'Please add a title'],
    default: 'Admissions Information',
    trim: true
  },

  // Header section
  headerSection: {
    title: {
      type: String,
      default: 'Admissions',
      trim: true
    },
    subtitle: {
      type: String,
      default: 'Join our community of learners and begin your educational journey with us.',
      trim: true
    }
  },

  // Main content
  mainContent: {
    type: String,
    required: [true, 'Please add main content'],
    trim: true
  },

  // Admission criteria
  admissionCriteria: {
    title: {
      type: String,
      default: 'Admission Criteria',
      trim: true
    },
    content: {
      type: String,
      required: [true, 'Please add admission criteria content'],
      trim: true
    }
  },

  // Application process
  applicationProcess: {
    title: {
      type: String,
      default: 'Application Process',
      trim: true
    },
    content: {
      type: String,
      required: [true, 'Please add application process content'],
      trim: true
    },
    steps: [
      {
        stepNumber: {
          type: Number,
          required: true
        },
        title: {
          type: String,
          required: true,
          trim: true
        },
        description: {
          type: String,
          required: true,
          trim: true
        }
      }
    ]
  },

  // Required documents
  requiredDocuments: {
    title: {
      type: String,
      default: 'Required Documents',
      trim: true
    },
    content: {
      type: String,
      required: [true, 'Please add required documents content'],
      trim: true
    },
    documentsList: [
      {
        text: {
          type: String,
          required: true,
          trim: true
        }
      }
    ]
  },

  // Fee structure
  feeStructure: {
    title: {
      type: String,
      default: 'Fee Structure',
      trim: true
    },
    content: {
      type: String,
      trim: true
    },
    disclaimer: {
      type: String,
      default: '* All fees are subject to change. Please contact the admissions office for the most up-to-date information.',
      trim: true
    },
    fees: [
      {
        feeType: {
          type: String,
          required: true,
          trim: true
        },
        amount: {
          type: String,
          required: true,
          trim: true
        },
        frequency: {
          type: String,
          required: true,
          trim: true
        }
      }
    ]
  },

  // Apply now section
  applyNow: {
    title: {
      type: String,
      default: 'Apply Now',
      trim: true
    },
    content: {
      type: String,
      default: 'Ready to apply? Download the application form or visit our campus to pick up an application package.',
      trim: true
    },
    primaryButtonText: {
      type: String,
      default: 'Download Application Form',
      trim: true
    },
    secondaryButtonText: {
      type: String,
      default: 'Contact Admissions Office',
      trim: true
    }
  },

  // FAQ section
  faqSection: {
    title: {
      type: String,
      default: 'Frequently Asked Questions',
      trim: true
    },
    subtitle: {
      type: String,
      default: 'Find answers to common questions about our admissions process.',
      trim: true
    },
    faqs: [
      {
        question: {
          type: String,
          required: true,
          trim: true
        },
        answer: {
          type: String,
          required: true,
          trim: true
        }
      }
    ]
  },

  // Downloadable files
  downloadableFiles: [
    {
      title: {
        type: String,
        required: [true, 'Please add file title'],
        trim: true
      },
      file: {
        type: String,
        required: [true, 'Please add file path'],
        trim: true
      },
      description: {
        type: String,
        trim: true
      }
    }
  ],

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
AdmissionsContentSchema.statics.findOneOrCreate = async function(userId) {
  const content = await this.findOne();
  if (content) {
    return content;
  }

  return this.create({
    title: 'Admissions Information',
    headerSection: {
      title: 'Admissions',
      subtitle: 'Join our community of learners and begin your educational journey with us.'
    },
    mainContent: 'Welcome to the admissions page of AI Based School. We are delighted that you are considering our school for your child\'s education.',
    admissionCriteria: {
      title: 'Admission Criteria',
      content: 'Admission to AI Based School is based on the student\'s academic record, entrance test performance, and interview.'
    },
    applicationProcess: {
      title: 'Application Process',
      content: 'At AI Based School, we welcome students from diverse backgrounds who demonstrate a commitment to learning and personal growth. Our admission process is designed to be straightforward while ensuring that we find the right fit for each student.',
      steps: [
        {
          stepNumber: 1,
          title: 'Application',
          description: 'Complete and submit the application form with all required documents.'
        },
        {
          stepNumber: 2,
          title: 'Assessment',
          description: 'Students take an entrance assessment to determine their academic level.'
        },
        {
          stepNumber: 3,
          title: 'Enrollment',
          description: 'Upon acceptance, complete the enrollment process and pay the required fees.'
        }
      ]
    },
    requiredDocuments: {
      title: 'Required Documents',
      content: 'Please ensure you have all the following documents ready when applying:',
      documentsList: [
        { text: 'Completed application form' },
        { text: 'Birth certificate or passport (for identification)' },
        { text: 'Previous school records and transcripts' },
        { text: 'Immunization records' },
        { text: 'Two passport-sized photographs' },
        { text: 'Parent/guardian identification' },
        { text: 'Proof of residence' }
      ]
    },
    feeStructure: {
      title: 'Fee Structure',
      content: 'Below is our current fee structure. Please note that fees are subject to annual review.',
      disclaimer: '* All fees are subject to change. Please contact the admissions office for the most up-to-date information.',
      fees: [
        {
          feeType: 'Application Fee',
          amount: '1,000',
          frequency: 'One-time'
        },
        {
          feeType: 'Admission Fee',
          amount: '10,000',
          frequency: 'One-time'
        },
        {
          feeType: 'Tuition Fee (Primary)',
          amount: '5,000',
          frequency: 'Monthly'
        },
        {
          feeType: 'Tuition Fee (Middle)',
          amount: '6,000',
          frequency: 'Monthly'
        },
        {
          feeType: 'Tuition Fee (High)',
          amount: '7,000',
          frequency: 'Monthly'
        },
        {
          feeType: 'Examination Fee',
          amount: '2,000',
          frequency: 'Bi-annual'
        },
        {
          feeType: 'Computer Lab Fee',
          amount: '1,000',
          frequency: 'Monthly'
        }
      ]
    },
    applyNow: {
      title: 'Apply Now',
      content: 'Ready to apply? Download the application form or visit our campus to pick up an application package.',
      primaryButtonText: 'Download Application Form',
      secondaryButtonText: 'Contact Admissions Office'
    },
    faqSection: {
      title: 'Frequently Asked Questions',
      subtitle: 'Find answers to common questions about our admissions process.',
      faqs: [
        {
          question: 'When can I apply for admission?',
          answer: 'Admissions are open throughout the year, but we recommend applying at least 2-3 months before the start of the academic year in August.'
        },
        {
          question: 'Is there an age requirement for admission?',
          answer: 'Yes, students must meet the minimum age requirement for their respective grade level as of August 31st of the academic year.'
        },
        {
          question: 'Are there any scholarships available?',
          answer: 'Yes, we offer merit-based and need-based scholarships. Please contact our admissions office for more information on eligibility criteria and application process.'
        },
        {
          question: 'What is the student-teacher ratio?',
          answer: 'We maintain a student-teacher ratio of 20:1 to ensure personalized attention and quality education for all students.'
        }
      ]
    },
    downloadableFiles: [],
    updatedBy: userId
  });
};

module.exports = mongoose.model('AdmissionsContent', AdmissionsContentSchema);

// const mongoose = require('mongoose');

// const AdmissionsContentSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     default: 'Admissions Information',
//     trim: true
//   },
//   headerSection: {
//     title: {
//       type: String,
//       default: 'Admissions',
//       trim: true
//     },
//     subtitle: {
//       type: String,
//       default: 'Join our community of learners',
//       trim: true
//     }
//   },
//   mainContent: {
//     type: String,
//     default: 'Welcome to our admissions page',
//     trim: true
//   },
//   admissionCriteria: {
//     title: String,
//     content: {
//       type: String,
//       default: 'Our admission requirements',
//       trim: true
//     }
//   },
//   applicationProcess: {
//     title: String,
//     content: String,
//     steps: [{
//       stepNumber: Number,
//       title: String,
//       description: String
//     }]
//   },
//   requiredDocuments: {
//     title: String,
//     content: String,
//     documentsList: [{
//       text: String
//     }]
//   },
//   feeStructure: {
//     title: String,
//     content: String,
//     fees: [{
//       feeType: String,
//       amount: String,
//       frequency: String
//     }]
//   },
//   downloadableFiles: [{
//     title: String,
//     file: String,
//     description: String
//   }],
//   updatedBy: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User'
//   }
// }, {
//   timestamps: true,
//   toJSON: { virtuals: true },
//   toObject: { virtuals: true }
// });

// AdmissionsContentSchema.statics.findOneOrCreate = async function(userId = null) {
//   let content = await this.findOne();
//   if (!content) {
//     content = await this.create({
//       title: 'Admissions Information',
//       headerSection: {
//         title: 'Admissions',
//         subtitle: 'Join our learning community'
//       },
//       mainContent: 'Welcome to our admissions process',
//       updatedBy: userId
//     });
//   }
//   return content;
// };

// module.exports = mongoose.model('AdmissionsContent', AdmissionsContentSchema);