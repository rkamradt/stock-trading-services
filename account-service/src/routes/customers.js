'use strict';

const { Router } = require('express');
const { param } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const customersService = require('../services/customers');

const router = Router();

/**
 * GET /customers/:customerId/accounts
 * Get all brokerage accounts that belong to a given customer.
 */
router.get(
  '/customers/:customerId/accounts',
  [
    param('customerId')
      .isString()
      .notEmpty()
      .withMessage('customerId is required'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const accounts = await customersService.getAccountsByCustomerId(req.params.customerId);
      res.json(accounts);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
