/**
 * Centralized Error Handling Middleware
 */
const errorHandler = (err, req, res, next) => {
  console.error('[Error caught in Middleware]:', err);

  const status = err.statusCode || err.status || 500;
  const message = err.message || 'Internal Server Error';

  res.status(status).json({
    success: false,
    error: {
      message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    }
  });
};

/**
 * 404 Not Found Middleware
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      message: `Route ${req.method} ${req.originalUrl} not found`
    }
  });
};

module.exports = {
  errorHandler,
  notFoundHandler
};
