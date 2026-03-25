// Per-student, per-feature pricing model
const FEATURE_PRICING = {
  STUDENTS: { price: 0.50, name: 'Student Management' },
  TEACHERS: { price: 0.30, name: 'Teacher Management' },
  ADMIN_STAFF: { price: 0.20, name: 'Administrative Staff' },
  ATTENDANCE: { price: 0.25, name: 'Attendance Tracking' },
  FEES: { price: 0.40, name: 'Fee Management' },
  SALARIES: { price: 0.35, name: 'Salary Management' },
  EVENTS: { price: 0.15, name: 'Events & Notices' },
  MEETINGS: { price: 0.20, name: 'Meeting Management' },
  BULK_UPLOAD: { price: 0.10, name: 'Bulk Upload' },
  CONTACT_MESSAGES: { price: 0.05, name: 'Contact Messages' },
  HISTORY: { price: 0.10, name: 'Activity History' },
  SCHOOL_SETTINGS: { price: 0.15, name: 'School Settings' },
  CONTENT_MANAGEMENT: { price: 0.25, name: 'Content Management' },
  RESULTS: { price: 0.30, name: 'Result Management' }
};

// Minimum monthly charge per school
const MINIMUM_MONTHLY_CHARGE = 10.00;

// Calculate monthly billing for a school
const calculateMonthlyBilling = (studentCount, enabledFeatures) => {
  let totalCost = 0;
  
  enabledFeatures.forEach(feature => {
    if (FEATURE_PRICING[feature]) {
      totalCost += FEATURE_PRICING[feature].price * studentCount;
    }
  });
  
  // Apply minimum charge
  return Math.max(totalCost, MINIMUM_MONTHLY_CHARGE);
};

module.exports = {
  FEATURE_PRICING,
  MINIMUM_MONTHLY_CHARGE,
  calculateMonthlyBilling
};