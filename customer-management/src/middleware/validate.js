'use strict';

const { validationResult } = require('express-validator');

/**
 * Inspects the express-validator result for the current request.
 * If there are validation errors, throws an object shaped for the error handler.
 *
 * @param {import('express').Request} req
 * @throws {{ status: number, message: string, errors: object[] }}
 */
function validateResult(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const err = new Error('Validation failed');
    err.status = 400;
    err.errors = result.array().map((e) => ({
      field: e.path,
      message: e.msg,
      value: e.value,
    }));
    throw err;
  }
}

module.exports = { validateResult };
