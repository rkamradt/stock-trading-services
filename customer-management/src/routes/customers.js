'use strict';

const { Router } = require('express');
const { body, param } = require('express-validator');
const { validateResult } = require('../middleware/validate');
const customersService = require('../services/customers');

const router = Router();

// ── Validation rule sets ──────────────────────────────────────────────────────

const customerIdParam = [
  param('customerId')
    .isUUID(4)
    .withMessage('customerId must be a valid UUID v4'),
];

const createCustomerRules = [
  body('firstName')
    .trim()
    .notEmpty()
    .withMessage('firstName is required')
    .isLength({ max: 100 })
    .withMessage('firstName must be 100 characters or fewer'),

  body('lastName')
    .trim()
    .notEmpty()
    .withMessage('lastName is required')
    .isLength({ max: 100 })
    .withMessage('lastName must be 100 characters or fewer'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('email is required')
    .isEmail()
    .withMessage('email must be a valid email address')
    .normalizeEmail(),

  body('phoneNumber')
    .trim()
    .notEmpty()
    .withMessage('phoneNumber is required')
    .matches(/^\+?[1-9]\d{6,14}$/)
    .withMessage('phoneNumber must be a valid E.164 phone number'),

  body('dateOfBirth')
    .notEmpty()
    .withMessage('dateOfBirth is required')
    .isISO8601()
    .withMessage('dateOfBirth must be an ISO 8601 date (YYYY-MM-DD)'),

  body('ssn')
    .notEmpty()
    .withMessage('ssn is required')
    .matches(/^\d{3}-\d{2}-\d{4}$/)
    .withMessage('ssn must match the format XXX-XX-XXXX'),

  body('address')
    .notEmpty()
    .withMessage('address is required')
    .isObject()
    .withMessage('address must be an object'),

  body('address.street')
    .trim()
    .notEmpty()
    .withMessage('address.street is required'),

  body('address.city')
    .trim()
    .notEmpty()
    .withMessage('address.city is required'),

  body('address.state')
    .trim()
    .notEmpty()
    .withMessage('address.state is required'),

  body('address.postalCode')
    .trim()
    .notEmpty()
    .withMessage('address.postalCode is required'),

  body('address.country')
    .trim()
    .notEmpty()
    .withMessage('address.country is required')
    .isISO31661Alpha2()
    .withMessage('address.country must be a valid ISO 3166-1 alpha-2 country code'),

  body('nationality')
    .trim()
    .notEmpty()
    .withMessage('nationality is required')
    .isISO31661Alpha2()
    .withMessage('nationality must be a valid ISO 3166-1 alpha-2 country code'),

  body('employmentStatus')
    .notEmpty()
    .withMessage('employmentStatus is required')
    .isIn(['EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED', 'RETIRED', 'STUDENT', 'OTHER'])
    .withMessage('employmentStatus must be one of: EMPLOYED, SELF_EMPLOYED, UNEMPLOYED, RETIRED, STUDENT, OTHER'),

  body('annualIncome')
    .notEmpty()
    .withMessage('annualIncome is required')
    .isFloat({ min: 0 })
    .withMessage('annualIncome must be a non-negative number'),
];

const updateCustomerRules = [
  ...customerIdParam,

  body('firstName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('firstName must not be blank')
    .isLength({ max: 100 })
    .withMessage('firstName must be 100 characters or fewer'),

  body('lastName')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('lastName must not be blank')
    .isLength({ max: 100 })
    .withMessage('lastName must be 100 characters or fewer'),

  body('phoneNumber')
    .optional()
    .trim()
    .matches(/^\+?[1-9]\d{6,14}$/)
    .withMessage('phoneNumber must be a valid E.164 phone number'),

  body('address')
    .optional()
    .isObject()
    .withMessage('address must be an object'),

  body('address.street').optional().trim().notEmpty().withMessage('address.street must not be blank'),
  body('address.city').optional().trim().notEmpty().withMessage('address.city must not be blank'),
  body('address.state').optional().trim().notEmpty().withMessage('address.state must not be blank'),
  body('address.postalCode').optional().trim().notEmpty().withMessage('address.postalCode must not be blank'),
  body('address.country')
    .optional()
    .trim()
    .isISO31661Alpha2()
    .withMessage('address.country must be a valid ISO 3166-1 alpha-2 country code'),

  body('employmentStatus')
    .optional()
    .isIn(['EMPLOYED', 'SELF_EMPLOYED', 'UNEMPLOYED', 'RETIRED', 'STUDENT', 'OTHER'])
    .withMessage('employmentStatus must be one of: EMPLOYED, SELF_EMPLOYED, UNEMPLOYED, RETIRED, STUDENT, OTHER'),

  body('annualIncome')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('annualIncome must be a non-negative number'),
];

const updateKycStatusRules = [
  ...customerIdParam,

  body('kycStatus')
    .notEmpty()
    .withMessage('kycStatus is required')
    .isIn(['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'])
    .withMessage('kycStatus must be one of: PENDING, IN_REVIEW, APPROVED, REJECTED, EXPIRED'),

  body('verificationProvider')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('verificationProvider must not be blank'),

  body('verificationReference')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('verificationReference must not be blank'),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('notes must be 1000 characters or fewer'),
];

// ── Route handlers ────────────────────────────────────────────────────────────

/**
 * POST /customers
 * Create a new customer profile
 */
router.post('/customers', createCustomerRules, async (req, res, next) => {
  try {
    validateResult(req);
    const customer = await customersService.createCustomer(req.body);
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /customers/:customerId
 * Retrieve customer information and verification status
 */
router.get('/customers/:customerId', customerIdParam, async (req, res, next) => {
  try {
    validateResult(req);
    const customer = await customersService.getCustomer(req.params.customerId);
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /customers/:customerId
 * Update customer personal information
 */
router.put('/customers/:customerId', updateCustomerRules, async (req, res, next) => {
  try {
    validateResult(req);
    const customer = await customersService.updateCustomer(req.params.customerId, req.body);
    res.json(customer);
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /customers/:customerId/kyc-status
 * Update KYC verification status
 */
router.put('/customers/:customerId/kyc-status', updateKycStatusRules, async (req, res, next) => {
  try {
    validateResult(req);
    const result = await customersService.updateKycStatus(req.params.customerId, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /customers/:customerId/compliance-status
 * Get current AML and compliance standing
 */
router.get('/customers/:customerId/compliance-status', customerIdParam, async (req, res, next) => {
  try {
    validateResult(req);
    const status = await customersService.getComplianceStatus(req.params.customerId);
    res.json(status);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
