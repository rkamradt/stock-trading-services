'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const tradesService = require('../services/trades');

const router = Router();

/**
 * POST /trades/risk-check
 * Validate a proposed trade against risk limits.
 */
router.post(
  '/trades/risk-check',
  [
    body('accountId')
      .isString()
      .notEmpty()
      .withMessage('accountId is required'),
    body('symbol')
      .isString()
      .notEmpty()
      .withMessage('symbol is required'),
    body('orderType')
      .isIn(['BUY', 'SELL', 'BUY_SHORT', 'BUY_TO_COVER'])
      .withMessage('orderType must be one of BUY, SELL, BUY_SHORT, BUY_TO_COVER'),
    body('assetClass')
      .isIn(['EQUITY', 'OPTION', 'FUTURE', 'ETF'])
      .withMessage('assetClass must be one of EQUITY, OPTION, FUTURE, ETF'),
    body('quantity')
      .isFloat({ gt: 0 })
      .withMessage('quantity must be a positive number'),
    body('estimatedNotional')
      .isFloat({ gt: 0 })
      .withMessage('estimatedNotional must be a positive number'),
    body('limitPrice')
      .optional()
      .isFloat({ gt: 0 })
      .withMessage('limitPrice must be a positive number if provided'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const result = await tradesService.performRiskCheck(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
