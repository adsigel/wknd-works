/**
 * Enhanced logging utility functions for consistent logging across the application
 */

import winston from 'winston';
import 'winston-daily-rotate-file';
import { v4 as uuidv4 } from 'uuid';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Error categories for better error tracking
export const ErrorCategory = {
  VALIDATION: 'VALIDATION',
  DATABASE: 'DATABASE',
  NETWORK: 'NETWORK',
  SHOPIFY_API: 'SHOPIFY_API',
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  INTERNAL: 'INTERNAL'
};

// Tell winston that we want to link the colors
winston.addColors(colors);

// Create the format for structured logging
const format = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.metadata({
    fillWith: ['timestamp', 'requestId', 'category', 'context']
  }),
  winston.format.json()
);

// Create console format for readability
const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, metadata }) => {
    const requestId = metadata.requestId ? ` [${metadata.requestId}]` : '';
    const category = metadata.category ? ` [${metadata.category}]` : '';
    return `${timestamp} ${level}${requestId}${category}: ${message}${
      metadata.stack ? '\n' + metadata.stack : ''
    }`;
  })
);

// Create the logger
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format,
  defaultMeta: { service: 'wknd-works-api' },
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      maxFiles: '14d'
    }),
    new winston.transports.DailyRotateFile({
      filename: 'logs/combined-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d'
    })
  ]
});

// Request context for tracking requests across the application
const requestContext = new Map();

/**
 * Initialize request context with a unique ID
 * @returns {string} Request ID
 */
export const initRequestContext = () => {
  const requestId = uuidv4();
  requestContext.set('requestId', requestId);
  return requestId;
};

/**
 * Get the current request ID
 * @returns {string|undefined} Request ID
 */
export const getRequestId = () => {
  return requestContext.get('requestId');
};

/**
 * Clear the request context
 */
export const clearRequestContext = () => {
  requestContext.clear();
};

/**
 * Log an error message with category and context
 * @param {string} message - Error message
 * @param {Error} [error] - Error object
 * @param {string} [category] - Error category from ErrorCategory
 * @param {Object} [context] - Additional context
 */
export const logError = (message, error, category = ErrorCategory.INTERNAL, context = {}) => {
  const metadata = {
    requestId: getRequestId(),
    category,
    context,
    ...(error && { stack: error.stack })
  };

  if (error) {
    logger.error(`${message}: ${error.message}`, metadata);
  } else {
    logger.error(message, metadata);
  }
};

/**
 * Log a warning message with context
 * @param {string} message - Warning message
 * @param {Object} [context] - Additional context
 */
export const logWarn = (message, context = {}) => {
  logger.warn(message, {
    requestId: getRequestId(),
    context
  });
};

/**
 * Log an info message with context
 * @param {string} message - Info message
 * @param {Object} [context] - Additional context
 */
export const logInfo = (message, context = {}) => {
  logger.info(message, {
    requestId: getRequestId(),
    context
  });
};

/**
 * Log an HTTP request with timing and context
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {number} status - Response status code
 * @param {number} [duration] - Request duration in ms
 * @param {Object} [context] - Additional context
 */
export const logHttp = (method, url, status, duration, context = {}) => {
  const message = `${method} ${url} ${status}${duration ? ` - ${duration}ms` : ''}`;
  logger.http(message, {
    requestId: getRequestId(),
    context: {
      method,
      url,
      status,
      duration,
      ...context
    }
  });
};

/**
 * Log a debug message with context
 * @param {string} message - Debug message
 * @param {Object} [context] - Additional context
 */
export const logDebug = (message, context = {}) => {
  logger.debug(message, {
    requestId: getRequestId(),
    context
  });
}; 