'use strict';

const { Router } = require('express');
const { param } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const accountsService = require('../services/accounts');

const router = Router();

/**
 * GET /accounts/:accountId/orders
 * Get all orders for an account.
 */
router.get(
  '/accounts/:accountId/orders',
  [
    param('accountId').isString().notEmpty().withMessage('accountId is required'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const orders = await accountsService.getOrdersForAccount(req.params.accountId);
      res.json(orders);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /accounts/:accountId/trades
 * Get trade execution history for an account.
 */
router.get(
  '/accounts/:accountId/trades',
  [
    param('accountId').isString().notEmpty().withMessage('accountId is required'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const trades = await accountsService.getTradesForAccount(req.params.accountId);
      res.json(trades);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
