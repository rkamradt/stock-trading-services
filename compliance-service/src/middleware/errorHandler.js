'use strict';

/**
 * Central Express error handler.
 * Maps err.status to an HTTP status code (default 500).
 * Returns a JSON body with error message and optional details array.
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

  res.status(status).json({
    error: message,
    details: err.errors || [],
  });
}

module.exports = errorHandler;
