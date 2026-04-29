'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const ordersService = require('../services/orders');

const router = Router();

/**
 * POST /orders
 * Submit a new trade order.
 */
router.post(
  '/orders',
  [
    body('accountId').isString().notEmpty().withMessage('accountId is required'),
    body('symbol')
      .isString()
      .notEmpty()
      .isUppercase()
      .withMessage('symbol must be a non-empty uppercase string (e.g. AAPL)'),
    body('side')
      .isIn(['BUY', 'SELL'])
      .withMessage('side must be BUY or SELL'),
    body('orderType')
      .isIn(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'])
      .withMessage('orderType must be one of MARKET, LIMIT, STOP, STOP_LIMIT'),
    body('quantity')
      .isFloat({ gt: 0 })
      .withMessage('quantity must be a positive number'),
    body('limitPrice')
      .optional({ nullable: true })
      .isFloat({ gt: 0 })
      .withMessage('limitPrice must be a positive number when provided'),
    body('stopPrice')
      .optional({ nullable: true })
      .isFloat({ gt: 0 })
      .withMessage('stopPrice must be a positive number when provided'),
    body('timeInForce')
      .optional()
      .isIn(['DAY', 'GTC', 'IOC', 'FOK'])
      .withMessage('timeInForce must be one of DAY, GTC, IOC, FOK'),
    body('notes')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 500 })
      .withMessage('notes must be a string of at most 500 characters'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const order = await ordersService.submitOrder(req.body);
      res.status(201).json(order);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /orders/:orderId
 * Get order status and fill details.
 */
router.get(
  '/orders/:orderId',
  [
    param('orderId').isUUID().withMessage('orderId must be a valid UUID'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const order = await ordersService.getOrder(req.params.orderId);
      res.json(order);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /orders/:orderId/cancel
 * Cancel a pending order.
 */
router.put(
  '/orders/:orderId/cancel',
  [
    param('orderId').isUUID().withMessage('orderId must be a valid UUID'),
    body('cancelReason')
      .optional({ nullable: true })
      .isString()
      .isLength({ max: 255 })
      .withMessage('cancelReason must be a string of at most 255 characters'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const order = await ordersService.cancelOrder(
        req.params.orderId,
        req.body.cancelReason || null
      );
      res.json(order);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /orders/:orderId/modify
 * Modify quantity or price of a pending order.
 */
router.put(
  '/orders/:orderId/modify',
  [
    param('orderId').isUUID().withMessage('orderId must be a valid UUID'),
    body('quantity')
      .optional({ nullable: true })
      .isFloat({ gt: 0 })
      .withMessage('quantity must be a positive number'),
    body('limitPrice')
      .optional({ nullable: true })
      .isFloat({ gt: 0 })
      .withMessage('limitPrice must be a positive number when provided'),
    body('stopPrice')
      .optional({ nullable: true })
      .isFloat({ gt: 0 })
      .withMessage('stopPrice must be a positive number when provided'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { quantity, limitPrice, stopPrice } = req.body;
      if (quantity == null && limitPrice == null && stopPrice == null) {
        const err = new Error('At least one of quantity, limitPrice, or stopPrice must be provided');
        err.status = 400;
        throw err;
      }
      const order = await ordersService.modifyOrder(req.params.orderId, {
        quantity,
        limitPrice,
        stopPrice,
      });
      res.json(order);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /orders/:orderId/executions
 * Get detailed execution information for an order.
 */
router.get(
  '/orders/:orderId/executions',
  [
    param('orderId').isUUID().withMessage('orderId must be a valid UUID'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const executions = await ordersService.getOrderExecutions(req.params.orderId);
      res.json(executions);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
