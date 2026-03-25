/**
 * Async middleware wrapper to eliminate try-catch blocks in controllers
 * @param {Function} fn - The async function to wrap
 * @returns {Function} Express middleware function
 */
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((error) => {
    // Ensure error has proper structure
    if (!error.statusCode && !error.status) {
      error.statusCode = 500;
    }
    
    // Log critical errors
    if (error.statusCode >= 500) {
      console.error('Critical error in async handler:', {
        message: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        tenant: req.tenantIdentifier
      });
    }
    
    next(error);
  });
};

module.exports = asyncHandler; 