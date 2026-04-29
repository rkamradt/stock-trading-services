'use strict';

const { Router } = require('express');
const { param, body } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const optionsService = require('../services/options');

const router = Router();

/**
 * GET /options/chains/:symbol
 * Get options chain for an underlying security.
 */
router.get(
  '/options/chains/:symbol',
  [
    param('symbol')
      .trim()
      .notEmpty()
      .withMessage('symbol is required')
      .isAlphanumeric()
      .withMessage('symbol must be alphanumeric')
      .isUppercase()
      .withMessage('symbol must be uppercase'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { symbol } = req.params;
      const chain = await optionsService.getOptionsChain(symbol);
      res.json(chain);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /options/:optionId/exercise
 * Exercise an option position.
 */
router.post(
  '/options/:optionId/exercise',
  [
    param('optionId').trim().notEmpty().withMessage('optionId is required'),
    body('accountId').trim().notEmpty().withMessage('accountId is required'),
    body('quantity')
      .isFloat({ gt: 0 })
      .withMessage('quantity must be a positive number'),
    body('exerciseType')
      .isIn(['AMERICAN', 'EUROPEAN'])
      .withMessage('exerciseType must be AMERICAN or EUROPEAN'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { optionId } = req.params;
      const { accountId, quantity, exerciseType } = req.body;
      const result = await optionsService.exerciseOption(optionId, {
        accountId,
        quantity,
        exerciseType,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
