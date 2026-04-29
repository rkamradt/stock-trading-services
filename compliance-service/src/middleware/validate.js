'use strict';

const { validationResult } = require('express-validator');

/**
 * Checks the result of express-validator chains on the current request.
 * Throws a structured error with status 400 if any validation failures exist.
 *
 * @param {import('express').Request} req
 */
function validateResult(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const err = new Error('Validation failed');
    err.status = 400;
    err.errors = result.array().map((e) => ({
      field: e.path || e.param,
      message: e.msg,
      value: e.value,
    }));
    throw err;
  }
}

module.exports = { validateResult };
