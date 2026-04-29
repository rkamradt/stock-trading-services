'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const bestExecutionService = require('../services/best-execution');

const router = Router();

/**
 * POST /best-execution/analysis
 * Analyze and report best execution compliance
 */
router.post(
  '/best-execution/analysis',
  [
    body('accountId')
      .notEmpty()
      .withMessage('accountId is required'),
    body('symbol')
      .notEmpty()
      .withMessage('symbol is required')
      .isString()
      .withMessage('symbol must be a string'),
    body('orderType')
      .notEmpty()
      .withMessage('orderType is required')
      .isIn(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT', 'TRAILING_STOP'])
      .withMessage('orderType must be a valid order type'),
    body('executedPrice')
      .notEmpty()
      .withMessage('executedPrice is required')
      .isFloat({ min: 0 })
      .withMessage('executedPrice must be a non-negative number'),
    body('executedQuantity')
      .notEmpty()
      .withMessage('executedQuantity is required')
      .isInt({ min: 1 })
      .withMessage('executedQuantity must be a positive integer'),
    body('marketPriceAtExecution')
      .notEmpty()
      .withMessage('marketPriceAtExecution is required')
      .isFloat({ min: 0 })
      .withMessage('marketPriceAtExecution must be a non-negative number'),
    body('executionVenue')
      .notEmpty()
      .withMessage('executionVenue is required')
      .isString()
      .withMessage('executionVenue must be a string'),
    body('executionTimestamp')
      .notEmpty()
      .withMessage('executionTimestamp is required')
      .isISO8601()
      .withMessage('executionTimestamp must be a valid ISO 8601 datetime'),
    body('orderId')
      .optional()
      .isString()
      .withMessage('orderId must be a string'),
    body('tradeId')
      .optional()
      .isString()
      .withMessage('tradeId must be a string'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const analysis = await bestExecutionService.analyzeBestExecution(req.body);
      res.status(201).json(analysis);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
