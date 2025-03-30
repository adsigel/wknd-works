import { logError, ErrorCategory } from '../utils/loggingUtils.js';
import { AppError } from '../utils/errorUtils.js';

/**
 * Global error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  let category = ErrorCategory.INTERNAL;
  let statusCode = 500;
  let message = 'Internal Server Error';
  
  // Determine error category and status code
  if (err instanceof AppError) {
    category = err.category || category;
    statusCode = err.statusCode || statusCode;
    message = err.message;
  } else if (err.name === 'ValidationError') {
    category = ErrorCategory.VALIDATION;
    statusCode = 400;
    message = err.message;
  } else if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    category = ErrorCategory.DATABASE;
    statusCode = err.code === 11000 ? 409 : 500;
    message = err.code === 11000 ? 'Duplicate key error' : 'Database error';
  } else if (err.name === 'CastError') {
    category = ErrorCategory.VALIDATION;
    statusCode = 400;
    message = 'Invalid ID format';
  }
  
  // Log the error with context
  logError(message, err, category, {
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
    params: req.params,
    headers: req.headers
  });
  
  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      code: statusCode,
      requestId: req.get('X-Request-ID')
    }
  });
}; 