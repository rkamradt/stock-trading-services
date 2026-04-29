'use strict';

const { Router } = require('express');
const { query } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const complianceService = require('../services/compliance');

const router = Router();

/**
 * GET /compliance/exposures
 * Get regulatory exposure reporting data.
 */
router.get(
  '/compliance/exposures',
  [
    query('assetClass')
      .optional()
      .isIn(['EQUITY', 'OPTION', 'FUTURE', 'ETF'])
      .withMessage('assetClass must be one of EQUITY, OPTION, FUTURE, ETF'),
    query('reportDate')
      .optional()
      .isISO8601()
      .withMessage('reportDate must be a valid ISO 8601 date (e.g. 2024-01-15)'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const report = await complianceService.getExposures({
        assetClass: req.query.assetClass || null,
        reportDate: req.query.reportDate || null,
      });
      res.status(200).json(report);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
