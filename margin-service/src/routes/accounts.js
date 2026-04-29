'use strict';

const { Router } = require('express');
const { param, body } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const accountsService = require('../services/accounts');

const router = Router();

// ─── GET /accounts/:accountId/buying-power ────────────────────────────────────
router.get(
  '/accounts/:accountId/buying-power',
  [param('accountId').notEmpty().withMessage('accountId is required')],
  async (req, res, next) => {
    try {
      validateResult(req);
      const result = await accountsService.getBuyingPower(req.params.accountId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /accounts/:accountId/margin-requirements ────────────────────────────
router.get(
  '/accounts/:accountId/margin-requirements',
  [param('accountId').notEmpty().withMessage('accountId is required')],
  async (req, res, next) => {
    try {
      validateResult(req);
      const result = await accountsService.getMarginRequirements(req.params.accountId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /accounts/:accountId/margin-calls ───────────────────────────────────
router.get(
  '/accounts/:accountId/margin-calls',
  [param('accountId').notEmpty().withMessage('accountId is required')],
  async (req, res, next) => {
    try {
      validateResult(req);
      const result = await accountsService.getMarginCalls(req.params.accountId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /accounts/:accountId/interest ───────────────────────────────────────
router.get(
  '/accounts/:accountId/interest',
  [param('accountId').notEmpty().withMessage('accountId is required')],
  async (req, res, next) => {
    try {
      validateResult(req);
      const result = await accountsService.getInterest(req.params.accountId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /accounts/:accountId/collateral ─────────────────────────────────────
router.get(
  '/accounts/:accountId/collateral',
  [param('accountId').notEmpty().withMessage('accountId is required')],
  async (req, res, next) => {
    try {
      validateResult(req);
      const result = await accountsService.getCollateral(req.params.accountId);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

// ─── POST /accounts/:accountId/liquidation ───────────────────────────────────
router.post(
  '/accounts/:accountId/liquidation',
  [
    param('accountId').notEmpty().withMessage('accountId is required'),
    body('reason').notEmpty().withMessage('reason is required'),
    body('authorizedBy').notEmpty().withMessage('authorizedBy is required'),
    body('liquidationTargetAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('liquidationTargetAmount must be a non-negative number'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const result = await accountsService.triggerLiquidation(
        req.params.accountId,
        req.body
      );
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
