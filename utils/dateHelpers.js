// Utility functions for date calculations

/**
 * Get the last date of a given month and year
 * @param {number} year - The year
 * @param {number} month - The month (0-11, where 0 is January)
 * @returns {Date} - Date object representing the last date of the month
 */
const getLastDateOfMonth = (year, month) => {
  return new Date(year, month + 1, 0);
};

/**
 * Get the last date of the current month
 * @returns {Date} - Date object representing the last date of current month
 */
const getLastDateOfCurrentMonth = () => {
  const now = new Date();
  return getLastDateOfMonth(now.getFullYear(), now.getMonth());
};

/**
 * Get the last date of a specific month for a given date
 * @param {Date} date - The date to get the month's last date for
 * @returns {Date} - Date object representing the last date of that month
 */
const getLastDateOfMonthForDate = (date) => {
  const targetDate = new Date(date);
  return getLastDateOfMonth(targetDate.getFullYear(), targetDate.getMonth());
};

/**
 * Check if a date is in the current month
 * @param {Date} date - The date to check
 * @returns {boolean} - True if date is in current month
 */
const isCurrentMonth = (date) => {
  const now = new Date();
  const targetDate = new Date(date);
  return now.getFullYear() === targetDate.getFullYear() && 
         now.getMonth() === targetDate.getMonth();
};

/**
 * Get the first date of a month for a given date
 * @param {Date} date - The date to get the month's first date for
 * @returns {Date} - Date object representing the first date of that month
 */
const getFirstDateOfMonthForDate = (date) => {
  const targetDate = new Date(date);
  return new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
};

module.exports = {
  getLastDateOfMonth,
  getLastDateOfCurrentMonth,
  getLastDateOfMonthForDate,
  isCurrentMonth,
  getFirstDateOfMonthForDate
};