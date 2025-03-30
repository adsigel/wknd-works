/**
 * Error utility functions for consistent error handling across the application
 */

import { ErrorCategory } from './loggingUtils.js';

/**
 * Custom application error class
 */
export class AppError extends Error {
  /**
   * Create a new AppError
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {string} category - Error category from ErrorCategory
   */
  constructor(message, statusCode = 500, category = ErrorCategory.INTERNAL) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.category = category;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Create a standardized error response
 * @param {Error} error - Error object
 * @returns {Object} Standardized error response
 */
export const createErrorResponse = (error) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const code = error instanceof AppError ? error.code : 'INTERNAL_SERVER_ERROR';
  const message = error.message || 'An unexpected error occurred';

  return {
    success: false,
    error: {
      code,
      message,
      statusCode
    }
  };
};

/**
 * Create a validation error
 * @param {string} message - Error message
 * @returns {AppError} Validation error
 */
export const createValidationError = (message) => {
  return new AppError(message, 400, ErrorCategory.VALIDATION);
};

/**
 * Create a not found error
 * @param {string} resource - Resource that was not found
 * @returns {AppError} Not found error
 */
export const createNotFoundError = (resource) => {
  return new AppError(`${resource} not found`, 404, ErrorCategory.INTERNAL);
};

/**
 * Create an unauthorized error
 * @param {string} message - Error message
 * @returns {AppError} Unauthorized error
 */
export const createUnauthorizedError = (message = 'Unauthorized') => {
  return new AppError(message, 401, ErrorCategory.AUTHENTICATION);
};

/**
 * Create a forbidden error
 * @param {string} message - Error message
 * @returns {AppError} Forbidden error
 */
export const createForbiddenError = (message = 'Forbidden') => {
  return new AppError(message, 403, ErrorCategory.AUTHORIZATION);
};

/**
 * Create a conflict error
 * @param {string} message - Error message
 * @returns {AppError} Conflict error
 */
export const createConflictError = (message) => {
  return new AppError(message, 409, ErrorCategory.INTERNAL);
};

/**
 * Create a database error
 * @param {string} message - Error message
 * @param {Error} [originalError] - Original database error
 * @returns {AppError} Database error
 */
export const createDatabaseError = (message, originalError) => {
  const error = new AppError(
    `Database error: ${message}`,
    500,
    ErrorCategory.DATABASE
  );
  if (originalError) {
    error.originalError = originalError;
  }
  return error;
};

/**
 * Create a network error
 * @param {string} message - Error message
 * @param {Error} [originalError] - Original network error
 * @returns {AppError} Network error
 */
export const createNetworkError = (message, originalError) => {
  const error = new AppError(
    `Network error: ${message}`,
    500,
    ErrorCategory.NETWORK
  );
  if (originalError) {
    error.originalError = originalError;
  }
  return error;
};

/**
 * Create a Shopify API error
 * @param {string} message - Error message
 * @param {Error} [originalError] - Original Shopify API error
 * @returns {AppError} Shopify API error
 */
export const createShopifyError = (message, originalError) => {
  const error = new AppError(
    `Shopify API error: ${message}`,
    500,
    ErrorCategory.SHOPIFY_API
  );
  if (originalError) {
    error.originalError = originalError;
  }
  return error;
}; 