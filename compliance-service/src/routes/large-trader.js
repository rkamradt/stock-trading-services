'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const largeTraderService = require('../services/large-trader');

const router = Router();

/**
 * POST /large-trader/reports
 * Generate large trader position reports
 */
router.post(
  '/large-trader/reports',
  [
    body('accountId')
      .notEmpty()
      .withMessage('accountId is required'),
    body('reportDate')
      .notEmpty()
      .withMessage('reportDate is required')
      .isISO8601()
      .withMessage('reportDate must be a valid ISO 8601 date'),
    body('reportingPeriod')
      .notEmpty()
      .withMessage('reportingPeriod is required')
      .isIn(['DAILY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'])
      .withMessage('reportingPeriod must be DAILY, MONTHLY, QUARTERLY, or ANNUAL'),
    body('positions')
      .notEmpty()
      .withMessage('positions is required')
      .isArray({ min: 1 })
      .withMessage('positions must be a non-empty array'),
    body('positions.*.symbol')
      .notEmpty()
      .withMessage('Each position must have a symbol'),
    body('positions.*.quantity')
      .notEmpty()
      .withMessage('Each position must have a quantity')
      .isInt({ min: 0 })
      .withMessage('Position quantity must be a non-negative integer'),
    body('positions.*.marketValue')
      .notEmpty()
      .withMessage('Each position must have a marketValue')
      .isFloat({ min: 0 })
      .withMessage('Position marketValue must be a non-negative number'),
    body('positions.*.transactionVolume')
      .notEmpty()
      .withMessage('Each position must have a transactionVolume')
      .isFloat({ min: 0 })
      .withMessage('Position transactionVolume must be a non-negative number'),
    body('largeTraderId')
      .optional()
      .isString()
      .withMessage('largeTraderId must be a string'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const report = await largeTraderService.generateLargeTraderReport(req.body);
      res.status(201).json(report);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
