'use strict';

const { Router } = require('express');
const { param, body } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const rulesService = require('../services/rules');

const router = Router();

/**
 * PUT /rules/:ruleId
 * Update compliance rule configurations and thresholds
 */
router.put(
  '/rules/:ruleId',
  [
    param('ruleId')
      .notEmpty()
      .withMessage('ruleId path parameter is required'),
    body('updatedBy')
      .notEmpty()
      .withMessage('updatedBy is required')
      .isString()
      .withMessage('updatedBy must be a string'),
    body('ruleName')
      .optional()
      .isString()
      .withMessage('ruleName must be a string')
      .isLength({ min: 2, max: 200 })
      .withMessage('ruleName must be between 2 and 200 characters'),
    body('description')
      .optional()
      .isString()
      .withMessage('description must be a string'),
    body('thresholds')
      .optional()
      .isObject()
      .withMessage('thresholds must be an object'),
    body('enabled')
      .optional()
      .isBoolean()
      .withMessage('enabled must be a boolean'),
    body('severity')
      .optional()
      .isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
      .withMessage('severity must be LOW, MEDIUM, HIGH, or CRITICAL'),
    body('applicableEntityTypes')
      .optional()
      .isArray()
      .withMessage('applicableEntityTypes must be an array'),
  ],
  async (req, res, next) => {
    try {
      validateResult(req);
      const { ruleId } = req.params;
      const updated = await rulesService.updateRule(ruleId, req.body);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
