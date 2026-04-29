'use strict';

const { Router } = require('express');
const { param, query } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const accountsService = require('../services/accounts');

const router = Router();

/**
 * GET /accounts/:accountId/performance
 * Generate portfolio performance analytics and benchmarking.
 */
router.get(
  '/accounts/:accountId/performance',
  [
    param('accountId').notEmpty().withMessage('accountId is required'),
    query('period')
      .optional()
      .isIn(['1M', '3M', '6M', 'YTD', '1Y', '3Y', '5Y', 'ALL'])
      .withMessage('period must be one of 1M, 3M, 6M, YTD, 1Y, 3Y, 5Y, ALL'),
    query('benchmark')
      .optional()
      .isString()
      .withMessage('benchmark must be a string (e.g. SPX, NDX)'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId } = req.params;
      const { period, benchmark } = req.query;
      const result = await accountsService.getPerformance({ accountId, period, benchmark });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /accounts/:accountId/position-summary
 * Create position and holdings summary reports.
 */
router.get(
  '/accounts/:accountId/position-summary',
  [
    param('accountId').notEmpty().withMessage('accountId is required'),
    query('asOf')
      .optional()
      .isISO8601()
      .withMessage('asOf must be a valid ISO 8601 date'),
    query('includeDerivatives')
      .optional()
      .isBoolean()
      .withMessage('includeDerivatives must be a boolean'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId } = req.params;
      const { asOf, includeDerivatives } = req.query;
      const result = await accountsService.getPositionSummary({
        accountId,
        asOf,
        includeDerivatives: includeDerivatives === 'true',
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
