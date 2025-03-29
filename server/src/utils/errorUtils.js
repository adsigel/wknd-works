/**
 * Error utility functions for consistent error handling across the application
 */

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_SERVER_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
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
  return new AppError(message, 400, 'VALIDATION_ERROR');
};

/**
 * Create a not found error
 * @param {string} message - Error message
 * @returns {AppError} Not found error
 */
export const createNotFoundError = (message) => {
  return new AppError(message, 404, 'NOT_FOUND');
};

/**
 * Create an unauthorized error
 * @param {string} message - Error message
 * @returns {AppError} Unauthorized error
 */
export const createUnauthorizedError = (message) => {
  return new AppError(message, 401, 'UNAUTHORIZED');
};

/**
 * Create a forbidden error
 * @param {string} message - Error message
 * @returns {AppError} Forbidden error
 */
export const createForbiddenError = (message) => {
  return new AppError(message, 403, 'FORBIDDEN');
};

/**
 * Create a conflict error
 * @param {string} message - Error message
 * @returns {AppError} Conflict error
 */
export const createConflictError = (message) => {
  return new AppError(message, 409, 'CONFLICT');
}; 