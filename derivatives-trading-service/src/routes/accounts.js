'use strict';

const { Router } = require('express');
const { param } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const accountsService = require('../services/accounts');

const router = Router();

/**
 * GET /accounts/:accountId/derivative-positions
 * Get all derivative positions and Greeks for an account.
 */
router.get(
  '/accounts/:accountId/derivative-positions',
  [
    param('accountId').trim().notEmpty().withMessage('accountId is required'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId } = req.params;
      const positions = await accountsService.getDerivativePositions(accountId);
      res.json(positions);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
