'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const accountsService = require('../services/accounts');

const router = Router();

/**
 * GET /accounts/:accountId/risk-metrics
 * Get current risk metrics and exposures for an account.
 */
router.get(
  '/accounts/:accountId/risk-metrics',
  [
    param('accountId')
      .isString()
      .notEmpty()
      .withMessage('accountId path parameter is required'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const metrics = await accountsService.getRiskMetrics(req.params.accountId);
      res.status(200).json(metrics);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /accounts/:accountId/risk-limits
 * Set or update risk limits and thresholds for an account.
 */
router.put(
  '/accounts/:accountId/risk-limits',
  [
    param('accountId')
      .isString()
      .notEmpty()
      .withMessage('accountId path parameter is required'),
    body('maxPositionSizePct')
      .optional()
      .isFloat({ gt: 0, lt: 1 })
      .withMessage('maxPositionSizePct must be a decimal between 0 and 1'),
    body('maxSectorConcentrationPct')
      .optional()
      .isFloat({ gt: 0, lt: 1 })
      .withMessage('maxSectorConcentrationPct must be a decimal between 0 and 1'),
    body('maxLeverageRatio')
      .optional()
      .isFloat({ gt: 1 })
      .withMessage('maxLeverageRatio must be greater than 1'),
    body('dailyLossLimit')
      .optional()
      .isFloat({ gt: 0 })
      .withMessage('dailyLossLimit must be a positive number'),
    body('maxDrawdownPct')
      .optional()
      .isFloat({ gt: 0, lt: 1 })
      .withMessage('maxDrawdownPct must be a decimal between 0 and 1'),
    body('maxOpenOrders')
      .optional()
      .isInt({ min: 1 })
      .withMessage('maxOpenOrders must be a positive integer'),
    body('allowedAssetClasses')
      .optional()
      .isArray({ min: 1 })
      .withMessage('allowedAssetClasses must be a non-empty array'),
    body('allowedAssetClasses.*')
      .optional()
      .isIn(['EQUITY', 'OPTION', 'FUTURE', 'ETF'])
      .withMessage('Each allowedAssetClass must be one of EQUITY, OPTION, FUTURE, ETF'),
    body('maxSingleOrderNotional')
      .optional()
      .isFloat({ gt: 0 })
      .withMessage('maxSingleOrderNotional must be a positive number'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const updated = await accountsService.updateRiskLimits(req.params.accountId, req.body);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
