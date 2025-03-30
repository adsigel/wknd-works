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

/**
 * Create a UTC date from a date string
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {Date} UTC date object
 * @throws {Error} If date string is invalid
 */
export const createUTCDate = (dateString) => {
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day || isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error('Invalid date string format. Expected YYYY-MM-DD');
  }
  if (month < 1 || month > 12) {
    throw new Error('Invalid month. Month must be between 1 and 12');
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!isValidDate(date) || date.getUTCMonth() !== month - 1) {
    throw new Error('Invalid date');
  }
  return date;
};

/**
 * Format a date as YYYY-MM-DD in UTC
 * @param {Date} date - Date object
 * @returns {string} Formatted UTC date string
 */
export const formatUTCDate = (date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Parse a Shopify date string to a local date object
 * @param {string} shopifyDateString - Shopify date string (ISO format)
 * @returns {Date} Local date object
 */
export const parseShopifyDate = (shopifyDateString) => {
  const date = new Date(shopifyDateString);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
};

/**
 * Get date range for a specific month
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {{start: Date, end: Date}} Start and end dates in UTC
 */
export const getDateRange = (year, month) => {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 0, 23, 59, 59));
  return { start, end };
};

/**
 * Check if a date object is valid
 * @param {Date} date - Date object to check
 * @returns {boolean} True if date is valid
 */
export const isValidDate = (date) => {
  return date instanceof Date && !isNaN(date);
};

/**
 * Compare two dates (ignoring time)
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {number} -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
export const compareDates = (date1, date2) => {
  const d1 = new Date(date1.getFullYear(), date1.getMonth(), date1.getDate());
  const d2 = new Date(date2.getFullYear(), date2.getMonth(), date2.getDate());
  return d1 < d2 ? -1 : d1 > d2 ? 1 : 0;
}; 