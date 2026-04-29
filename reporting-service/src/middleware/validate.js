'use strict';

const { validationResult } = require('express-validator');

/**
 * Inspects the express-validator result on the current request.
 * Throws a structured 400 error if any validation failures are present.
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
