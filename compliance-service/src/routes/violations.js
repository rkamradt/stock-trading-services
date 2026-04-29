'use strict';

const { Router } = require('express');
const { query } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const violationsService = require('../services/violations');

const router = Router();

/**
 * GET /violations
 * Get current compliance violations and alerts
 */
router.get(
  '/violations',
  [
    query('accountId')
      .optional()
      .isString()
      .withMessage('accountId must be a string'),
    query('severity')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
      .withMessage('severity must be LOW, MEDIUM, HIGH, or CRITICAL'),
    query('status')
      .optional()
      .isIn(['OPEN', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED', 'DISMISSED'])
      .withMessage('status must be a valid violation status'),
    query('fromDate')
      .optional()
      .isISO8601()
      .withMessage('fromDate must be a valid ISO 8601 date'),
    query('toDate')
      .optional()
      .isISO8601()
      .withMessage('toDate must be a valid ISO 8601 date'),
    query('ruleId')
      .optional()
      .isString()
      .withMessage('ruleId must be a string'),
    query('entityType')
      .optional()
      .isIn(['CUSTOMER', 'ACCOUNT', 'TRADE', 'ORDER', 'POSITION'])
      .withMessage('entityType must be a valid entity type'),
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
        accountId: req.query.accountId,
        severity: req.query.severity,
        status: req.query.status,
        fromDate: req.query.fromDate,
        toDate: req.query.toDate,
        ruleId: req.query.ruleId,
        entityType: req.query.entityType,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 50,
        offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
      };
      const result = await violationsService.getViolations(filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
