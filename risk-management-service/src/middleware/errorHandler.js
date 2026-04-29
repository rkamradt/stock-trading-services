'use strict';

/**
 * Centralised Express error handler.
 * Must be mounted as the last middleware in the application.
 *
 * @param {Error & { status?: number; errors?: object[] }} err
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
