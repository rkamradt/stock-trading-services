'use strict';

/**
 * Central Express error handler.
 * Must be mounted as the last middleware in the chain.
 *
 * @param {Error & { status?: number; errors?: any[] }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';

  if (status >= 500) {
    console.error(`[reporting-service] ERROR ${status} — ${message}`, err.stack || '');
  }

  res.status(status).json({
    error: message,
    details: err.errors || [],
  });
}

module.exports = errorHandler;
