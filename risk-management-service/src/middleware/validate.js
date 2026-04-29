'use strict';

const { validationResult } = require('express-validator');

/**
 * Extracts and validates express-validator results from a request.
 * Throws a structured error if any validation failures are found.
 *
 * @param {import('express').Request} req
 * @throws {{ status: number, message: string, errors: object[] }}
 */
function validateResult(req) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    const err = new Error('Validation failed');
    err.status = 400;
    err.errors = result.array();
    throw err;
  }
}

module.exports = { validateResult };
