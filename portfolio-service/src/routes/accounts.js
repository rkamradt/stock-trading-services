'use strict';

const { Router } = require('express');
const { param, body, query } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const svc = require('../services/accounts');

const router = Router();

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

const accountIdParam = param('accountId')
  .trim()
  .notEmpty()
  .withMessage('accountId path parameter is required');

const symbolParam = param('symbol')
  .trim()
  .notEmpty()
  .withMessage('symbol path parameter is required')
  .isAlphanumeric()
  .withMessage('symbol must contain only letters and numbers')
  .isLength({ min: 1, max: 10 })
  .withMessage('symbol must be between 1 and 10 characters');

const corporateActionBody = [
  body('actionType')
    .trim()
    .notEmpty()
    .withMessage('actionType is required')
    .isIn(['split', 'reverse_split', 'cash_dividend', 'stock_dividend', 'spin_off'])
    .withMessage(
      'actionType must be one of: split, reverse_split, cash_dividend, stock_dividend, spin_off'
    ),
  body('effectiveDate')
    .optional()
    .isISO8601()
    .withMessage('effectiveDate must be a valid ISO 8601 date'),
  body('splitRatio')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('splitRatio must be a positive number'),
  body('dividendAmount')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('dividendAmount must be a positive number'),
  body('spinOffSymbol')
    .optional()
    .trim()
    .isAlphanumeric()
    .withMessage('spinOffSymbol must contain only letters and numbers'),
  body('spinOffRatio')
    .optional()
    .isFloat({ gt: 0 })
    .withMessage('spinOffRatio must be a positive number'),
  body('notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('notes must not exceed 500 characters'),
];

// ---------------------------------------------------------------------------
// GET /accounts/:accountId/positions
// Get all stock positions for an account
// ---------------------------------------------------------------------------
router.get(
  '/accounts/:accountId/positions',
  [accountIdParam],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId } = req.params;
      const data = await svc.listPositions(accountId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /accounts/:accountId/positions/:symbol
// Get position details for a specific security
// ---------------------------------------------------------------------------
router.get(
  '/accounts/:accountId/positions/:symbol',
  [accountIdParam, symbolParam],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId, symbol } = req.params;
      const data = await svc.getPosition(accountId, symbol);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /accounts/:accountId/pnl
// Calculate realized and unrealized P&L for the portfolio
// ---------------------------------------------------------------------------
router.get(
  '/accounts/:accountId/pnl',
  [accountIdParam],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId } = req.params;
      const data = await svc.calculatePnl(accountId);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /accounts/:accountId/positions/:symbol/history
// Get position history and cost basis details for a specific security
// ---------------------------------------------------------------------------
router.get(
  '/accounts/:accountId/positions/:symbol/history',
  [accountIdParam, symbolParam],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId, symbol } = req.params;
      const data = await svc.getPositionHistory(accountId, symbol);
      res.json(data);
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /accounts/:accountId/positions/:symbol/corporate-actions
// Record corporate action adjustments (splits, dividends, spin-offs)
// ---------------------------------------------------------------------------
router.post(
  '/accounts/:accountId/positions/:symbol/corporate-actions',
  [accountIdParam, symbolParam, ...corporateActionBody],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId, symbol } = req.params;
      const action = req.body;
      const data = await svc.applyCorporateAction(accountId, symbol, action);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
