'use strict';

/**
 * Central Express error handler.
 * Must be mounted as the last middleware (4-argument signature).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  const details = err.errors || [];

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.path} — ${message}`, err.stack || '');
  }

  res.status(status).json({
    error: message,
    details,
  });
}

module.exports = errorHandler;
