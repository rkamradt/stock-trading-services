'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const suspiciousActivityService = require('../services/suspicious-activity');

const router = Router();

/**
 * POST /suspicious-activity/reports
 * File suspicious activity reports (SAR)
 */
router.post(
  '/suspicious-activity/reports',
  [
    body('subjectEntityId')
      .notEmpty()
      .withMessage('subjectEntityId is required'),
    body('subjectEntityType')
      .notEmpty()
      .withMessage('subjectEntityType is required')
      .isIn(['CUSTOMER', 'ACCOUNT', 'COUNTERPARTY', 'EMPLOYEE'])
      .withMessage('subjectEntityType must be CUSTOMER, ACCOUNT, COUNTERPARTY, or EMPLOYEE'),
    body('activityType')
      .notEmpty()
      .withMessage('activityType is required')
      .isIn([
        'STRUCTURING',
        'MONEY_LAUNDERING',
        'INSIDER_TRADING',
        'MARKET_MANIPULATION',
        'FRAUD',
        'IDENTITY_THEFT',
        'TAX_EVASION',
        'TERRORIST_FINANCING',
        'OTHER',
      ])
      .withMessage('activityType must be a valid suspicious activity type'),
    body('activityDescription')
      .notEmpty()
      .withMessage('activityDescription is required')
      .isString()
      .withMessage('activityDescription must be a string')
      .isLength({ min: 20 })
      .withMessage('activityDescription must be at least 20 characters'),
    body('activityDateStart')
      .notEmpty()
      .withMessage('activityDateStart is required')
      .isISO8601()
      .withMessage('activityDateStart must be a valid ISO 8601 date'),
    body('activityDateEnd')
      .notEmpty()
      .withMessage('activityDateEnd is required')
      .isISO8601()
      .withMessage('activityDateEnd must be a valid ISO 8601 date'),
    body('amount')
      .notEmpty()
      .withMessage('amount is required')
      .isFloat({ min: 0 })
      .withMessage('amount must be a non-negative number'),
    body('currency')
      .notEmpty()
      .withMessage('currency is required')
      .isLength({ min: 3, max: 3 })
      .withMessage('currency must be a 3-letter ISO currency code'),
    body('filedBy')
      .notEmpty()
      .withMessage('filedBy is required')
      .isString()
      .withMessage('filedBy must be a string'),
    body('narrativeSummary')
      .notEmpty()
      .withMessage('narrativeSummary is required')
      .isString()
      .withMessage('narrativeSummary must be a string')
      .isLength({ min: 50 })
      .withMessage('narrativeSummary must be at least 50 characters'),
    body('transactionIds')
      .optional()
      .isArray()
      .withMessage('transactionIds must be an array'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const sar = await suspiciousActivityService.fileSAR(req.body);
      res.status(201).json(sar);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
