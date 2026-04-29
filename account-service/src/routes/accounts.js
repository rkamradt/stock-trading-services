'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const accountsService = require('../services/accounts');

const router = Router();

/**
 * POST /accounts
 * Create a new brokerage account for a customer.
 */
router.post(
  '/accounts',
  [
    body('customerId')
      .isString()
      .notEmpty()
      .withMessage('customerId is required'),
    body('accountType')
      .isIn(['INDIVIDUAL', 'JOINT', 'IRA', 'MARGIN'])
      .withMessage('accountType must be one of INDIVIDUAL, JOINT, IRA, MARGIN'),
    body('currency')
      .optional()
      .isISO4217()
      .withMessage('currency must be a valid ISO 4217 code'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { customerId, accountType, currency } = req.body;
      const account = await accountsService.createAccount({ customerId, accountType, currency });
      res.status(201).json(account);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /accounts/:accountId
 * Retrieve account details and current balances.
 */
router.get(
  '/accounts/:accountId',
  [
    param('accountId').isString().notEmpty().withMessage('accountId is required'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const account = await accountsService.getAccountById(req.params.accountId);
      res.json(account);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /accounts/:accountId/settings
 * Update account trading permissions and settings.
 */
router.put(
  '/accounts/:accountId/settings',
  [
    param('accountId').isString().notEmpty().withMessage('accountId is required'),
    body('tradingPermissions')
      .optional()
      .isArray()
      .withMessage('tradingPermissions must be an array'),
    body('tradingPermissions.*')
      .optional()
      .isIn(['EQUITIES', 'OPTIONS', 'FUTURES', 'FOREX', 'CRYPTO'])
      .withMessage('Each tradingPermission must be a valid permission type'),
    body('marginEnabled')
      .optional()
      .isBoolean()
      .withMessage('marginEnabled must be a boolean'),
    body('optionsLevel')
      .optional()
      .isInt({ min: 0, max: 4 })
      .withMessage('optionsLevel must be an integer between 0 and 4'),
    body('dayTradingEnabled')
      .optional()
      .isBoolean()
      .withMessage('dayTradingEnabled must be a boolean'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId } = req.params;
      const settings = req.body;
      const account = await accountsService.updateAccountSettings(accountId, settings);
      res.json(account);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /accounts/:accountId/deposits
 * Record a cash deposit to the account.
 */
router.post(
  '/accounts/:accountId/deposits',
  [
    param('accountId').isString().notEmpty().withMessage('accountId is required'),
    body('amount')
      .isFloat({ gt: 0 })
      .withMessage('amount must be a positive number'),
    body('currency')
      .optional()
      .isISO4217()
      .withMessage('currency must be a valid ISO 4217 code'),
    body('reference')
      .optional()
      .isString()
      .withMessage('reference must be a string'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId } = req.params;
      const { amount, currency, reference } = req.body;
      const result = await accountsService.recordDeposit(accountId, { amount, currency, reference });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /accounts/:accountId/withdrawals
 * Process a cash withdrawal from the account.
 */
router.post(
  '/accounts/:accountId/withdrawals',
  [
    param('accountId').isString().notEmpty().withMessage('accountId is required'),
    body('amount')
      .isFloat({ gt: 0 })
      .withMessage('amount must be a positive number'),
    body('currency')
      .optional()
      .isISO4217()
      .withMessage('currency must be a valid ISO 4217 code'),
    body('reference')
      .optional()
      .isString()
      .withMessage('reference must be a string'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId } = req.params;
      const { amount, currency, reference } = req.body;
      const result = await accountsService.recordWithdrawal(accountId, { amount, currency, reference });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /accounts/:accountId/equity
 * Calculate total account equity including positions.
 */
router.get(
  '/accounts/:accountId/equity',
  [
    param('accountId').isString().notEmpty().withMessage('accountId is required'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const equity = await accountsService.getAccountEquity(req.params.accountId);
      res.json(equity);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
