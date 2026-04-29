'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const reportsService = require('../services/reports');

const router = Router();

/**
 * POST /reports/statements
 * Generate account statements for specified date ranges.
 */
router.post(
  '/reports/statements',
  [
    body('accountId').notEmpty().withMessage('accountId is required'),
    body('startDate')
      .notEmpty()
      .withMessage('startDate is required')
      .isISO8601()
      .withMessage('startDate must be a valid ISO 8601 date'),
    body('endDate')
      .notEmpty()
      .withMessage('endDate is required')
      .isISO8601()
      .withMessage('endDate must be a valid ISO 8601 date')
      .custom((endDate, { req }) => {
        if (new Date(endDate) < new Date(req.body.startDate)) {
          throw new Error('endDate must be on or after startDate');
        }
        return true;
      }),
    body('format')
      .optional()
      .isIn(['PDF', 'CSV', 'JSON'])
      .withMessage('format must be one of PDF, CSV, JSON'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId, startDate, endDate, format } = req.body;
      const result = await reportsService.generateStatement({ accountId, startDate, endDate, format });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /reports/trade-confirmations
 * Create trade confirmation reports for executed orders.
 */
router.post(
  '/reports/trade-confirmations',
  [
    body('accountId').notEmpty().withMessage('accountId is required'),
    body('tradeIds')
      .optional()
      .isArray()
      .withMessage('tradeIds must be an array'),
    body('tradeIds.*')
      .optional()
      .isString()
      .withMessage('each tradeId must be a string'),
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('startDate must be a valid ISO 8601 date'),
    body('endDate')
      .optional()
      .isISO8601()
      .withMessage('endDate must be a valid ISO 8601 date'),
    body('format')
      .optional()
      .isIn(['PDF', 'CSV', 'JSON'])
      .withMessage('format must be one of PDF, CSV, JSON'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId, tradeIds, startDate, endDate, format } = req.body;
      const result = await reportsService.generateTradeConfirmations({
        accountId,
        tradeIds,
        startDate,
        endDate,
        format,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /reports/margin-utilization
 * Generate margin and buying power utilization reports.
 */
router.post(
  '/reports/margin-utilization',
  [
    body('accountId').notEmpty().withMessage('accountId is required'),
    body('startDate')
      .notEmpty()
      .withMessage('startDate is required')
      .isISO8601()
      .withMessage('startDate must be a valid ISO 8601 date'),
    body('endDate')
      .notEmpty()
      .withMessage('endDate is required')
      .isISO8601()
      .withMessage('endDate must be a valid ISO 8601 date')
      .custom((endDate, { req }) => {
        if (new Date(endDate) < new Date(req.body.startDate)) {
          throw new Error('endDate must be on or after startDate');
        }
        return true;
      }),
    body('format')
      .optional()
      .isIn(['PDF', 'CSV', 'JSON'])
      .withMessage('format must be one of PDF, CSV, JSON'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { accountId, startDate, endDate, format } = req.body;
      const result = await reportsService.generateMarginUtilizationReport({
        accountId,
        startDate,
        endDate,
        format,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /reports/regulatory
 * Create regulatory compliance and filing reports.
 */
router.post(
  '/reports/regulatory',
  [
    body('reportType')
      .notEmpty()
      .withMessage('reportType is required')
      .isIn(['FINRA', 'SEC', 'FORM_1099', 'FORM_8949', 'LARGE_TRADER', 'SAR', 'BEST_EXECUTION'])
      .withMessage('reportType must be one of FINRA, SEC, FORM_1099, FORM_8949, LARGE_TRADER, SAR, BEST_EXECUTION'),
    body('startDate')
      .notEmpty()
      .withMessage('startDate is required')
      .isISO8601()
      .withMessage('startDate must be a valid ISO 8601 date'),
    body('endDate')
      .notEmpty()
      .withMessage('endDate is required')
      .isISO8601()
      .withMessage('endDate must be a valid ISO 8601 date')
      .custom((endDate, { req }) => {
        if (new Date(endDate) < new Date(req.body.startDate)) {
          throw new Error('endDate must be on or after startDate');
        }
        return true;
      }),
    body('accountId').optional().isString().withMessage('accountId must be a string'),
    body('jurisdiction')
      .optional()
      .isIn(['US', 'EU', 'UK', 'GLOBAL'])
      .withMessage('jurisdiction must be one of US, EU, UK, GLOBAL'),
    body('format')
      .optional()
      .isIn(['PDF', 'CSV', 'JSON', 'XML'])
      .withMessage('format must be one of PDF, CSV, JSON, XML'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { reportType, accountId, startDate, endDate, jurisdiction, format } = req.body;
      const result = await reportsService.generateRegulatoryReport({
        reportType,
        accountId,
        startDate,
        endDate,
        jurisdiction,
        format,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /reports/schedule
 * Schedule automated report generation and delivery.
 */
router.post(
  '/reports/schedule',
  [
    body('reportType')
      .notEmpty()
      .withMessage('reportType is required')
      .isIn(['STATEMENT', 'TRADE_CONFIRMATION', 'MARGIN_UTILIZATION', 'REGULATORY', 'PERFORMANCE', 'POSITION_SUMMARY'])
      .withMessage(
        'reportType must be one of STATEMENT, TRADE_CONFIRMATION, MARGIN_UTILIZATION, REGULATORY, PERFORMANCE, POSITION_SUMMARY'
      ),
    body('accountId').notEmpty().withMessage('accountId is required'),
    body('frequency')
      .notEmpty()
      .withMessage('frequency is required')
      .isIn(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY'])
      .withMessage('frequency must be one of DAILY, WEEKLY, MONTHLY, QUARTERLY, ANNUALLY'),
    body('deliveryChannel')
      .notEmpty()
      .withMessage('deliveryChannel is required')
      .isIn(['EMAIL', 'SFTP', 'API_WEBHOOK', 'SECURE_PORTAL'])
      .withMessage('deliveryChannel must be one of EMAIL, SFTP, API_WEBHOOK, SECURE_PORTAL'),
    body('deliveryAddress').notEmpty().withMessage('deliveryAddress is required'),
    body('startDate')
      .optional()
      .isISO8601()
      .withMessage('startDate must be a valid ISO 8601 date'),
    body('format')
      .optional()
      .isIn(['PDF', 'CSV', 'JSON', 'XML'])
      .withMessage('format must be one of PDF, CSV, JSON, XML'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { reportType, accountId, frequency, deliveryChannel, deliveryAddress, startDate, format } = req.body;
      const result = await reportsService.scheduleReport({
        reportType,
        accountId,
        frequency,
        deliveryChannel,
        deliveryAddress,
        startDate,
        format,
      });
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
