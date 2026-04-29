'use strict';

const { validationResult } = require('express-validator');

/**
 * Inspect the validation result accumulated by express-validator chains.
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
