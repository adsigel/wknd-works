import { initRequestContext, clearRequestContext, logHttp } from '../utils/loggingUtils.js';

/**
 * Middleware to initialize request context and log HTTP requests
 */
export const requestLogger = (req, res, next) => {
  // Initialize request context with unique ID
  const requestId = initRequestContext();
  
  // Record start time
  const startTime = Date.now();
  
  // Add requestId to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Log request
  logHttp(
    req.method,
    req.originalUrl,
    res.statusCode,
    undefined,
    {
      userAgent: req.get('user-agent'),
      ip: req.ip
    }
  );
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(...args) {
    // Calculate request duration
    const duration = Date.now() - startTime;
    
    // Log response
    logHttp(
      req.method,
      req.originalUrl,
      res.statusCode,
      duration,
      {
        userAgent: req.get('user-agent'),
        ip: req.ip
      }
    );
    
    // Clear request context
    clearRequestContext();
    
    // Call original end
    originalEnd.apply(res, args);
  };
  
  next();
}; 