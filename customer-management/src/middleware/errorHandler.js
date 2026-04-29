'use strict';

/**
 * Central Express error handler.
 * Must be registered LAST (after all routes and other middleware).
 *
 * @param {Error & { status?: number; errors?: object[] }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || 500;

  if (status >= 500) {
    console.error(`[customer-management] Unhandled error on ${req.method} ${req.path}:`, err);
  }

  res.status(status).json({
    error: err.message || 'Internal Server Error',
    details: err.errors || [],
  });
}

module.exports = errorHandler;
