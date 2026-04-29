'use strict';

const { Router } = require('express');
const { param, query } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const portfoliosService = require('../services/portfolios');

const router = Router();

/**
 * GET /portfolios/:portfolioId/var
 * Calculate Value at Risk (VaR) for a portfolio.
 */
router.get(
  '/portfolios/:portfolioId/var',
  [
    param('portfolioId')
      .isString()
      .notEmpty()
      .withMessage('portfolioId path parameter is required'),
    query('confidenceLevel')
      .optional()
      .isFloat({ gt: 0, lt: 1 })
      .withMessage('confidenceLevel must be a decimal between 0 and 1 (e.g. 0.95)'),
    query('horizon')
      .optional()
      .isInt({ min: 1 })
      .withMessage('horizon must be a positive integer representing days'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const confidenceLevel = req.query.confidenceLevel
        ? parseFloat(req.query.confidenceLevel)
        : 0.95;
      const horizon = req.query.horizon ? parseInt(req.query.horizon, 10) : 1;
      const varResult = await portfoliosService.calculateVaR(
        req.params.portfolioId,
        confidenceLevel,
        horizon
      );
      res.status(200).json(varResult);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
