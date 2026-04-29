'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const derivativesService = require('../services/derivatives');

const router = Router();

/**
 * POST /derivatives/orders
 * Submit derivative orders (options, futures, swaps).
 */
router.post(
  '/derivatives/orders',
  [
    body('accountId').trim().notEmpty().withMessage('accountId is required'),
    body('instrumentType')
      .isIn(['OPTION', 'FUTURE', 'SWAP'])
      .withMessage('instrumentType must be OPTION, FUTURE, or SWAP'),
    body('symbol').trim().notEmpty().withMessage('symbol is required'),
    body('side')
      .isIn(['BUY', 'SELL', 'BUY_TO_OPEN', 'BUY_TO_CLOSE', 'SELL_TO_OPEN', 'SELL_TO_CLOSE'])
      .withMessage('side must be a valid order side'),
    body('quantity')
      .isFloat({ gt: 0 })
      .withMessage('quantity must be a positive number'),
    body('orderType')
      .isIn(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'])
      .withMessage('orderType must be MARKET, LIMIT, STOP, or STOP_LIMIT'),
    body('limitPrice')
      .optional()
      .isFloat({ gt: 0 })
      .withMessage('limitPrice must be a positive number'),
    body('expiration')
      .optional()
      .isISO8601()
      .withMessage('expiration must be a valid ISO8601 date'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const {
        accountId,
        instrumentType,
        symbol,
        side,
        quantity,
        orderType,
        limitPrice,
        expiration,
      } = req.body;
      const order = await derivativesService.submitOrder({
        accountId,
        instrumentType,
        symbol,
        side,
        quantity,
        orderType,
        limitPrice,
        expiration,
      });
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /derivatives/expirations
 * Get expiration schedules and assignment notices.
 */
router.get('/derivatives/expirations', async (req, res, next) => {
  try {
    const expirations = await derivativesService.getExpirations();
    res.json(expirations);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /derivatives/:derivativeId/greeks
 * Calculate Greeks (delta, gamma, theta, vega) for a derivative.
 */
router.get(
  '/derivatives/:derivativeId/greeks',
  [
    param('derivativeId').trim().notEmpty().withMessage('derivativeId is required'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { derivativeId } = req.params;
      const greeks = await derivativesService.getGreeks(derivativeId);
      res.json(greeks);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
