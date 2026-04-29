'use strict';

const { Router } = require('express');
const { query } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const surveillanceService = require('../services/surveillance');

const router = Router();

/**
 * GET /surveillance/patterns
 * Monitor trade patterns and detect compliance violations
 */
router.get(
  '/surveillance/patterns',
  [
    query('patternType')
      .optional()
      .isIn(['WASH_TRADING', 'FRONT_RUNNING', 'LAYERING', 'SPOOFING', 'INSIDER_TRADING', 'MARKET_MANIPULATION', 'PAINTING_THE_TAPE'])
      .withMessage('patternType must be a valid surveillance pattern type'),
    query('accountId')
      .optional()
      .isString()
      .withMessage('accountId must be a string'),
    query('fromDate')
      .optional()
      .isISO8601()
      .withMessage('fromDate must be a valid ISO 8601 date'),
    query('toDate')
      .optional()
      .isISO8601()
      .withMessage('toDate must be a valid ISO 8601 date'),
    query('status')
      .optional()
      .isIn(['DETECTED', 'UNDER_REVIEW', 'ESCALATED', 'CLEARED', 'CONFIRMED_VIOLATION'])
      .withMessage('status must be a valid pattern status'),
    query('severity')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
      .withMessage('severity must be LOW, MEDIUM, HIGH, or CRITICAL'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 500 })
      .withMessage('limit must be between 1 and 500'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('offset must be a non-negative integer'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const filters = {
        patternType: req.query.patternType,
        accountId: req.query.accountId,
        fromDate: req.query.fromDate,
        toDate: req.query.toDate,
        status: req.query.status,
        severity: req.query.severity,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
      };
      const result = await surveillanceService.getSurveillancePatterns(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
