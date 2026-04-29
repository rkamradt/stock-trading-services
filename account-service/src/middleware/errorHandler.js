'use strict';

/**
 * Central Express error handler.
 * Must be mounted last with app.use(errorHandler).
 *
 * @param {Error & { status?: number, errors?: object[] }} err
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
    console.error(`[account-service] ERROR ${status} — ${message}`, err.stack);
  }

  res.status(status).json({
    error: message,
    details,
  });
}

module.exports = errorHandler;
