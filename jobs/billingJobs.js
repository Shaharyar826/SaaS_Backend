const cron = require('node-cron');
const BillingService = require('../services/billingService');

// Run on the 1st of every month at 2 AM
const scheduleMonthlyBilling = () => {
  cron.schedule('0 2 1 * *', async () => {
    console.log('Starting monthly billing generation...');
    
    try {
      const results = await BillingService.generateMonthlyBills();
      console.log('Monthly billing completed:', results);
    } catch (error) {
      console.error('Monthly billing failed:', error);
    }
  }, {
    timezone: "UTC"
  });
  
  console.log('Monthly billing cron job scheduled');
};

// Run daily at 6 AM to update overdue bills
const scheduleOverdueUpdates = () => {
  cron.schedule('0 6 * * *', async () => {
    console.log('Updating overdue bills...');
    
    try {
      const result = await BillingService.updateOverdueBills();
      console.log(`Updated ${result.modifiedCount} overdue bills`);
    } catch (error) {
      console.error('Failed to update overdue bills:', error);
    }
  }, {
    timezone: "UTC"
  });
  
  console.log('Overdue bills update cron job scheduled');
};

module.exports = {
  scheduleMonthlyBilling,
  scheduleOverdueUpdates
};