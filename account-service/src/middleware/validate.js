'use strict';

const { validationResult } = require('express-validator');

/**
 * Reads express-validator results from the request and throws a structured
 * 400 error if any validation failures are present.
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
