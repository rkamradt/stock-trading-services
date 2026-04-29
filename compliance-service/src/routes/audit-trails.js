'use strict';

const { Router } = require('express');
const { param, query } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const auditTrailsService = require('../services/audit-trails');

const router = Router();

/**
 * GET /audit-trails/:entityId
 * Query audit trails and transaction history for compliance review
 */
router.get(
  '/audit-trails/:entityId',
  [
    param('entityId')
      .notEmpty()
      .withMessage('entityId path parameter is required'),
    query('fromDate')
      .optional()
      .isISO8601()
      .withMessage('fromDate must be a valid ISO 8601 date'),
    query('toDate')
      .optional()
      .isISO8601()
      .withMessage('toDate must be a valid ISO 8601 date'),
    query('action')
      .optional()
      .isString()
      .withMessage('action must be a string'),
    query('resourceType')
      .optional()
      .isString()
      .withMessage('resourceType must be a string'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 1000 })
      .withMessage('limit must be an integer between 1 and 1000'),
    query('offset')
      .optional()
      .isInt({ min: 0 })
      .withMessage('offset must be a non-negative integer'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { entityId } = req.params;
      const filters = {
        fromDate: req.query.fromDate,
        toDate: req.query.toDate,
        action: req.query.action,
        resourceType: req.query.resourceType,
        limit: req.query.limit ? parseInt(req.query.limit, 10) : 100,
        offset: req.query.offset ? parseInt(req.query.offset, 10) : 0,
      };
      const result = await auditTrailsService.getAuditTrails(entityId, filters);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
