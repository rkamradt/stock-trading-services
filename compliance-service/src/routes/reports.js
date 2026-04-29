'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const reportsService = require('../services/reports');

const router = Router();

/**
 * POST /reports/regulatory
 * Generate regulatory reports and filings for FINRA, SEC
 */
router.post(
  '/reports/regulatory',
  [
    body('reportType')
      .notEmpty()
      .withMessage('reportType is required')
      .isIn(['FINRA_TRADE_REPORT', 'SEC_FORM_13F', 'SEC_FORM_13H', 'FINRA_LARGE_TRADER', 'SEC_FOCUS', 'FINRA_CAT', 'SEC_RULE_606'])
      .withMessage('reportType must be a valid regulatory report type'),
    body('regulatoryBody')
      .notEmpty()
      .withMessage('regulatoryBody is required')
      .isIn(['FINRA', 'SEC', 'CFTC', 'MSRB'])
      .withMessage('regulatoryBody must be one of FINRA, SEC, CFTC, MSRB'),
    body('periodStart')
      .notEmpty()
      .withMessage('periodStart is required')
      .isISO8601()
      .withMessage('periodStart must be a valid ISO 8601 date'),
    body('periodEnd')
      .notEmpty()
      .withMessage('periodEnd is required')
      .isISO8601()
      .withMessage('periodEnd must be a valid ISO 8601 date'),
    body('submittedBy')
      .notEmpty()
      .withMessage('submittedBy is required')
      .isString()
      .withMessage('submittedBy must be a string'),
    body('accountIds')
      .optional()
      .isArray()
      .withMessage('accountIds must be an array'),
    body('entityIds')
      .optional()
      .isArray()
      .withMessage('entityIds must be an array'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const report = await reportsService.generateRegulatoryReport(req.body);
      res.status(201).json(report);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
