/**
 * Date utility functions for consistent date handling across the application
 */

/**
 * Convert a date string to a local date object
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date} Local date object
 */
export const createLocalDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
};

/**
 * Format a date as YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
export const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get the first day of a month
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {Date} First day of the month
 */
export const getFirstDayOfMonth = (year, month) => {
  return new Date(year, month - 1, 1);
};

/**
 * Get the last day of a month
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {Date} Last day of the month
 */
export const getLastDayOfMonth = (year, month) => {
  return new Date(year, month, 0);
};

/**
 * Get all dates in a month
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {string[]} Array of dates in YYYY-MM-DD format
 */
export const getAllDatesInMonth = (year, month) => {
  const dates = [];
  const firstDay = getFirstDayOfMonth(year, month);
  const lastDay = getLastDayOfMonth(year, month);
  
  for (let date = new Date(firstDay); date <= lastDay; date.setDate(date.getDate() + 1)) {
    dates.push(formatDate(new Date(date)));
  }
  
  return dates;
};

/**
 * Get day of week (0-6, where 0 is Sunday)
 * @param {Date} date - Date object
 * @returns {number} Day of week
 */
export const getDayOfWeek = (date) => {
  return date.getDay();
};

/**
 * Get day name (Sunday, Monday, etc.)
 * @param {number} dayOfWeek - Day of week (0-6)
 * @returns {string} Day name
 */
export const getDayName = (dayOfWeek) => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayOfWeek];
}; 