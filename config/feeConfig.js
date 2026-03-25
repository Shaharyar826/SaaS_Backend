// Fee Management Configuration
// This file contains configuration settings for the fee management system

const feeConfig = {
  // Fee types available in the system
  feeTypes: ['tuition', 'exam', 'transport', 'library', 'laboratory', 'other'],
  
  // Payment methods available
  paymentMethods: ['cash', 'check', 'online', 'bank transfer', 'other'],
  
  // Fee statuses
  feeStatuses: ['paid', 'unpaid', 'partial', 'overdue'],
  
  // Default fine per absence (can be overridden per student/class)
  defaultAbsenceFine: 50,
  
  // Maximum consecutive months for enhanced fine calculation
  maxConsecutiveMonths: 6
};

// Helper function to check if a given date is before student's admission date
const isBeforeAdmissionDate = (checkDate, admissionDate) => {
  return new Date(checkDate) < new Date(admissionDate);
};

// Helper function to get student's admission month start
const getAdmissionMonthStart = (admissionDate) => {
  const date = new Date(admissionDate);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

module.exports = {
  feeConfig,
  isBeforeAdmissionDate,
  getAdmissionMonthStart
};
