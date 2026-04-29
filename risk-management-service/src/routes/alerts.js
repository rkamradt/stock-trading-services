'use strict';

const { Router } = require('express');
const { query } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const alertsService = require('../services/alerts');

const router = Router();

/**
 * GET /alerts/risk-breaches
 * Get current risk limit violations and warnings.
 */
router.get(
  '/alerts/risk-breaches',
  [
    query('accountId')
      .optional()
      .isString()
      .notEmpty()
      .withMessage('accountId must be a non-empty string if provided'),
    query('severity')
      .optional()
      .isIn(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'])
      .withMessage('severity must be one of CRITICAL, HIGH, MEDIUM, LOW'),
    query('status')
      .optional()
      .isIn(['ACTIVE', 'ACKNOWLEDGED', 'RESOLVED'])
      .withMessage('status must be one of ACTIVE, ACKNOWLEDGED, RESOLVED'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const breaches = await alertsService.getRiskBreaches({
        accountId: req.query.accountId || null,
        severity: req.query.severity || null,
        status: req.query.status || null,
      });
      res.status(200).json(breaches);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
