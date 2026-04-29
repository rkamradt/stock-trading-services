'use strict';

/**
 * Central Express error handler.
 * Must be mounted LAST with app.use(errorHandler).
 *
 * Recognises errors thrown with { status, message, errors } shape
 * (produced by validate.js and service layer).
 *
 * @param {Error & { status?: number, errors?: any[] }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  const details = err.errors || [];

  if (status >= 500) {
    console.error('[ErrorHandler]', err);
  }

  res.status(status).json({
    error: message,
    details,
  });
}

module.exports = errorHandler;
