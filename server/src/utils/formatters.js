/**
 * Format a number as currency
 * @param {number} amount - The amount to format
 * @param {string} currency - The currency code (default: 'USD')
 * @param {number} minDigits - Minimum fraction digits (default: 0)
 * @param {number} maxDigits - Maximum fraction digits (default: 0)
 * @returns {string} Formatted currency string
 */
export const formatCurrency = (amount, currency = 'USD', minDigits = 0, maxDigits = 0) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: minDigits,
    maximumFractionDigits: maxDigits
  }).format(amount);
};

/**
 * Format a number with commas
 * @param {number} num - The number to format
 * @returns {string} Formatted number string
 */
export const formatNumber = (num) => {
  return new Intl.NumberFormat('en-US').format(num);
};

/**
 * Format a percentage
 * @param {number} value - The value to format as percentage
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (value, decimals = 1) => {
  return value.toFixed(decimals) + '%';
}; 