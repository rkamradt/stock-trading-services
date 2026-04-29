'use strict';

const { Router } = require('express');
const { body } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const stressTestsService = require('../services/stress-tests');

const router = Router();

/**
 * POST /stress-tests
 * Run stress testing scenarios against portfolio positions.
 */
router.post(
  '/stress-tests',
  [
    body('portfolioId')
      .isString()
      .notEmpty()
      .withMessage('portfolioId is required'),
    body('accountId')
      .isString()
      .notEmpty()
      .withMessage('accountId is required'),
    body('scenarios')
      .isArray({ min: 1 })
      .withMessage('scenarios must be a non-empty array'),
    body('scenarios.*.scenarioName')
      .isString()
      .notEmpty()
      .withMessage('Each scenario must have a scenarioName'),
    body('scenarios.*.equityShock')
      .optional()
      .isFloat()
      .withMessage('equityShock must be a numeric value (e.g. -0.20 for a 20% drop)'),
    body('scenarios.*.interestRateShock')
      .optional()
      .isFloat()
      .withMessage('interestRateShock must be a numeric value'),
    body('scenarios.*.volatilityShock')
      .optional()
      .isFloat()
      .withMessage('volatilityShock must be a numeric value'),
    body('scenarios.*.creditSpreadShock')
      .optional()
      .isFloat()
      .withMessage('creditSpreadShock must be a numeric value'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const result = await stressTestsService.runStressTests(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
