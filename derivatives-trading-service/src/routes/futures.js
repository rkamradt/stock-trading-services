'use strict';

const { Router } = require('express');
const { param, body } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const futuresService = require('../services/futures');

const router = Router();

/**
 * POST /futures/:futuresId/close
 * Close or roll a futures position.
 */
router.post(
  '/futures/:futuresId/close',
  [
    param('futuresId').trim().notEmpty().withMessage('futuresId is required'),
    body('accountId').trim().notEmpty().withMessage('accountId is required'),
    body('action')
      .isIn(['CLOSE', 'ROLL'])
      .withMessage('action must be CLOSE or ROLL'),
    body('quantity')
      .isFloat({ gt: 0 })
      .withMessage('quantity must be a positive number'),
    body('rollToContractId')
      .optional()
      .trim()
      .notEmpty()
      .withMessage('rollToContractId must not be empty if provided'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { futuresId } = req.params;
      const { accountId, action, quantity, rollToContractId } = req.body;

      if (action === 'ROLL' && !rollToContractId) {
        const err = new Error('rollToContractId is required when action is ROLL');
        err.status = 400;
        throw err;
      }

      const result = await futuresService.closeFutures(futuresId, {
        accountId,
        action,
        quantity,
        rollToContractId,
      });
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
