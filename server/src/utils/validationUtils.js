/**
 * Validation utility functions for request validation
 */

import { createValidationError } from './errorUtils.js';

/**
 * Validate month number (1-12)
 * @param {number} month - Month number
 * @throws {AppError} If month is invalid
 */
export const validateMonth = (month) => {
  const monthNum = Number(month);
  if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
    throw createValidationError('Month must be a number between 1 and 12');
  }
  return monthNum;
};

/**
 * Validate year number
 * @param {number} year - Year number
 * @throws {AppError} If year is invalid
 */
export const validateYear = (year) => {
  const yearNum = Number(year);
  if (isNaN(yearNum) || yearNum < 2000 || yearNum > new Date().getFullYear()) {
    throw createValidationError('Year must be a valid number between 2000 and current year');
  }
  return yearNum;
};

/**
 * Validate date string format (YYYY-MM-DD)
 * @param {string} dateString - Date string
 * @throws {AppError} If date format is invalid
 */
export const validateDateString = (dateString) => {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    throw createValidationError('Date must be in YYYY-MM-DD format');
  }

  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw createValidationError('Invalid date');
  }

  return dateString;
};

/**
 * Validate numeric value is positive
 * @param {number} value - Numeric value
 * @param {string} fieldName - Name of the field being validated
 * @throws {AppError} If value is not positive
 */
export const validatePositiveNumber = (value, fieldName) => {
  const num = Number(value);
  if (isNaN(num) || num <= 0) {
    throw createValidationError(`${fieldName} must be a positive number`);
  }
  return num;
};

/**
 * Validate string is not empty
 * @param {string} value - String value
 * @param {string} fieldName - Name of the field being validated
 * @throws {AppError} If string is empty
 */
export const validateNonEmptyString = (value, fieldName) => {
  if (!value || typeof value !== 'string' || value.trim().length === 0) {
    throw createValidationError(`${fieldName} cannot be empty`);
  }
  return value.trim();
}; 