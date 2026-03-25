// Complete system rebranding configuration
export const BRAND_CONFIG = {
  // Main SaaS Brand
  saas: {
    name: 'EduFlow Pro',
    tagline: 'Complete Educational Institution Management Platform',
    description: 'Streamline operations, enhance productivity, and drive growth for educational institutions worldwide',
    domain: 'eduflowpro.com',
    logo: '/assets/eduflow-logo.svg',
    favicon: '/assets/eduflow-favicon.ico'
  },

  // Generic terminology mapping
  terminology: {
    // Hide school-specific terms
    'school': 'institution',
    'School': 'Institution', 
    'SCHOOL': 'INSTITUTION',
    'student': 'learner',
    'Student': 'Learner',
    'STUDENT': 'LEARNER',
    'teacher': 'instructor',
    'Teacher': 'Instructor',
    'TEACHER': 'INSTRUCTOR',
    'principal': 'administrator',
    'Principal': 'Administrator',
    'classroom': 'learning space',
    'grade': 'level',
    'homework': 'assignments',
    'exam': 'assessment',
    'report card': 'progress report'
  },

  // Industry verticals
  verticals: {
    education: {
      name: 'Educational Institutions',
      icon: 'graduation-cap',
      features: ['Learner Management', 'Instructor Portal', 'Assessment Tools', 'Progress Tracking']
    },
    training: {
      name: 'Training Centers',
      icon: 'users',
      features: ['Course Management', 'Certification Tracking', 'Skills Assessment', 'Resource Library']
    },
    corporate: {
      name: 'Corporate Learning',
      icon: 'building',
      features: ['Employee Development', 'Compliance Training', 'Performance Analytics', 'Learning Paths']
    },
    coaching: {
      name: 'Coaching Institutes',
      icon: 'target',
      features: ['Batch Management', 'Test Series', 'Performance Analytics', 'Parent Communication']
    }
  },

  // Feature categories (generic names)
  features: {
    core: {
      name: 'Core Management',
      items: ['User Management', 'Attendance Tracking', 'Communication Hub', 'Document Management']
    },
    financial: {
      name: 'Financial Operations',
      items: ['Fee Collection', 'Payment Processing', 'Financial Reports', 'Billing Automation']
    },
    analytics: {
      name: 'Analytics & Insights',
      items: ['Performance Dashboards', 'Custom Reports', 'Trend Analysis', 'Predictive Analytics']
    },
    automation: {
      name: 'Process Automation',
      items: ['Workflow Automation', 'Notification System', 'Bulk Operations', 'Integration APIs']
    }
  }
};

// URL and route mappings to hide origins
export const ROUTE_MAPPING = {
  '/students': '/learners',
  '/teachers': '/instructors', 
  '/school-settings': '/institution-settings',
  '/student-fees': '/learner-fees',
  '/teacher-profile': '/instructor-profile'
};

// Database collection name mappings
export const COLLECTION_MAPPING = {
  'students': 'learners',
  'teachers': 'instructors',
  'schoolsettings': 'institutionsettings'
};