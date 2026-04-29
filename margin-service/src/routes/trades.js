'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const tradesService = require('../services/trades');

const router = Router();

// ─── POST /trades/margin-check ────────────────────────────────────────────────
router.post(
  '/trades/margin-check',
  [
    body('accountId').notEmpty().withMessage('accountId is required'),
    body('symbol').notEmpty().withMessage('symbol is required'),
    body('side')
      .notEmpty()
      .isIn(['buy', 'sell', 'sell_short', 'buy_to_cover'])
      .withMessage('side must be one of: buy, sell, sell_short, buy_to_cover'),
    body('quantity')
      .isFloat({ min: 0.0001 })
      .withMessage('quantity must be a positive number'),
    body('estimatedPrice')
      .isFloat({ min: 0 })
      .withMessage('estimatedPrice must be a non-negative number'),
    body('orderType')
      .notEmpty()
      .isIn(['market', 'limit', 'stop', 'stop_limit'])
      .withMessage('orderType must be one of: market, limit, stop, stop_limit'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const result = await tradesService.checkMargin(req.body);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
