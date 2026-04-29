'use strict';

/**
 * Centralised Express error handler.
 * Must be mounted LAST in the middleware chain (4-argument signature).
 *
 * @param {Error & { status?: number; errors?: object[] }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} _next
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  const details = err.errors || [];

  if (status >= 500) {
    console.error('[errorHandler]', err);
  }

  res.status(status).json({
    error: message,
    details,
  });
}

module.exports = errorHandler;
