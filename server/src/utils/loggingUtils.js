/**
 * Logging utility functions for consistent logging across the application
 */

import winston from 'winston';

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

// Tell winston that we want to link the colors
winston.addColors(colors);

// Create the format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Create the logger
export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  levels,
  format,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({ filename: 'logs/all.log' })
  ]
});

/**
 * Log an error message
 * @param {string} message - Error message
 * @param {Error} [error] - Error object
 */
export const logError = (message, error) => {
  if (error) {
    logger.error(`${message}: ${error.message}`);
    if (error.stack) {
      logger.error(error.stack);
    }
  } else {
    logger.error(message);
  }
};

/**
 * Log a warning message
 * @param {string} message - Warning message
 */
export const logWarn = (message) => {
  logger.warn(message);
};

/**
 * Log an info message
 * @param {string} message - Info message
 */
export const logInfo = (message) => {
  logger.info(message);
};

/**
 * Log an HTTP request
 * @param {string} method - HTTP method
 * @param {string} url - Request URL
 * @param {number} status - Response status code
 * @param {number} [duration] - Request duration in ms
 */
export const logHttp = (method, url, status, duration) => {
  const message = `${method} ${url} ${status}${duration ? ` - ${duration}ms` : ''}`;
  logger.http(message);
};

/**
 * Log a debug message
 * @param {string} message - Debug message
 */
export const logDebug = (message) => {
  logger.debug(message);
}; 