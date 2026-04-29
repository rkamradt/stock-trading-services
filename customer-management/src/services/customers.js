'use strict';

const { v4: uuidv4 } = require('uuid');

// ── In-memory store ───────────────────────────────────────────────────────────
// Key: customerId (UUID v4)
// Value: full customer record
/** @type {Map<string, object>} */
const store = new Map();

// ── Event publisher (stub) ────────────────────────────────────────────────────
// In production this would publish to a message broker (Kafka, RabbitMQ, etc.)
// using the EVENT_BUS_URL environment variable.
function publishEvent(topic, payload) {
  const envelope = {
    eventId: uuidv4(),
    topic,
    timestamp: new Date().toISOString(),
    payload,
  };
  // Log for observability in development; replace with real broker client in production.
  console.log(`[customer-management] EVENT → ${topic}:`, JSON.stringify(envelope));
  // TODO(production): await brokerClient.publish(topic, envelope);
}

// ── Helper: derive onboarding status from kyc status ─────────────────────────
function deriveOnboardingStatus(kycStatus, currentOnboardingStatus) {
  if (currentOnboardingStatus === 'SUSPENDED' || currentOnboardingStatus === 'REJECTED') {
    return currentOnboardingStatus;
  }
  switch (kycStatus) {
    case 'PENDING':
      return 'KYC_PENDING';
    case 'IN_REVIEW':
      return 'KYC_IN_REVIEW';
    case 'APPROVED':
      return 'ACTIVE';
    case 'REJECTED':
      return 'REJECTED';
    case 'EXPIRED':
      return 'KYC_PENDING';
    default:
      return currentOnboardingStatus;
  }
}

// ── Helper: derive compliance status from kyc status ─────────────────────────
function deriveComplianceStatus(kycStatus) {
  switch (kycStatus) {
    case 'APPROVED':
      return 'CLEAR';
    case 'REJECTED':
      return 'BLOCKED';
    case 'IN_REVIEW':
      return 'UNDER_REVIEW';
    default:
      return 'UNDER_REVIEW';
  }
}

// ── Helper: not found error ───────────────────────────────────────────────────
function notFound(customerId) {
  const err = new Error(`Customer not found: ${customerId}`);
  err.status = 404;
  return err;
}

// ── Helper: conflict error ────────────────────────────────────────────────────
function conflict(message) {
  const err = new Error(message);
  err.status = 409;
  return err;
}

// ── Service operations ────────────────────────────────────────────────────────

/**
 * Create a new customer profile.
 *
 * @param {object} data - Validated request body
 * @returns {Promise<object>} Created customer record
 */
async function createCustomer(data) {
  // Enforce unique email constraint
  for (const existing of store.values()) {
    if (existing.email === data.email.toLowerCase()) {
      throw conflict(`A customer with email ${data.email} already exists`);
    }
  }

  const now = new Date().toISOString();
  const customerId = uuidv4();

  const customer = {
    customerId,
    firstName: data.firstName.trim(),
    lastName: data.lastName.trim(),
    email: data.email.toLowerCase(),
    phoneNumber: data.phoneNumber.trim(),
    dateOfBirth: data.dateOfBirth,
    // SSN is stored but never returned in GET responses (masked).
    ssnLast4: data.ssn.slice(-4),
    address: {
      street: data.address.street.trim(),
      city: data.address.city.trim(),
      state: data.address.state.trim(),
      postalCode: data.address.postalCode.trim(),
      country: data.address.country.toUpperCase(),
    },
    nationality: data.nationality.toUpperCase(),
    employmentStatus: data.employmentStatus,
    annualIncome: parseFloat(data.annualIncome),

    // KYC / compliance state
    kycStatus: 'PENDING',
    kycCompletedAt: null,
    verificationProvider: null,
    verificationReference: null,
    kycNotes: null,

    complianceStatus: 'UNDER_REVIEW',
    amlStatus: 'CLEAR',
    sanctionsScreeningStatus: 'CLEAR',
    riskRating: 'LOW',
    complianceFlags: [],
    lastReviewedAt: null,

    // Onboarding state
    onboardingStatus: 'KYC_PENDING',

    createdAt: now,
    updatedAt: now,
  };

  store.set(customerId, customer);

  publishEvent('customer.created', {
    eventType: 'customer.created',
    customerId: customer.customerId,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    onboardingStatus: customer.onboardingStatus,
    kycStatus: customer.kycStatus,
    createdAt: customer.createdAt,
  });

  return sanitizeCustomer(customer);
}

/**
 * Retrieve a customer by ID.
 *
 * @param {string} customerId
 * @returns {Promise<object>}
 */
async function getCustomer(customerId) {
  const customer = store.get(customerId);
  if (!customer) throw notFound(customerId);
  return sanitizeCustomer(customer);
}

/**
 * Update personal information for an existing customer.
 * Immutable fields: email, dateOfBirth, ssn, kycStatus, complianceStatus.
 *
 * @param {string} customerId
 * @param {object} updates - Validated request body
 * @returns {Promise<object>}
 */
async function updateCustomer(customerId, updates) {
  const customer = store.get(customerId);
  if (!customer) throw notFound(customerId);

  const now = new Date().toISOString();

  // Apply permitted updates
  const mutableFields = ['firstName', 'lastName', 'phoneNumber', 'employmentStatus'];
  for (const field of mutableFields) {
    if (updates[field] !== undefined) {
      customer[field] = typeof updates[field] === 'string' ? updates[field].trim() : updates[field];
    }
  }

  if (updates.annualIncome !== undefined) {
    customer.annualIncome = parseFloat(updates.annualIncome);
  }

  if (updates.address) {
    customer.address = {
      street: (updates.address.street || customer.address.street).trim(),
      city: (updates.address.city || customer.address.city).trim(),
      state: (updates.address.state || customer.address.state).trim(),
      postalCode: (updates.address.postalCode || customer.address.postalCode).trim(),
      country: (updates.address.country || customer.address.country).toUpperCase(),
    };
  }

  customer.updatedAt = now;
  store.set(customerId, customer);

  return sanitizeCustomer(customer);
}

/**
 * Update the KYC verification status for a customer.
 *
 * @param {string} customerId
 * @param {object} data - { kycStatus, verificationProvider?, verificationReference?, notes? }
 * @returns {Promise<object>}
 */
async function updateKycStatus(customerId, data) {
  const customer = store.get(customerId);
  if (!customer) throw notFound(customerId);

  const now = new Date().toISOString();

  const previousKycStatus = customer.kycStatus;
  const previousComplianceStatus = customer.complianceStatus;
  const previousOnboardingStatus = customer.onboardingStatus;

  customer.kycStatus = data.kycStatus;
  if (data.verificationProvider !== undefined) customer.verificationProvider = data.verificationProvider.trim();
  if (data.verificationReference !== undefined) customer.verificationReference = data.verificationReference.trim();
  if (data.notes !== undefined) customer.kycNotes = data.notes.trim();

  if (data.kycStatus === 'APPROVED') {
    customer.kycCompletedAt = now;
  }

  // Derive downstream statuses
  const newOnboardingStatus = deriveOnboardingStatus(data.kycStatus, customer.onboardingStatus);
  const newComplianceStatus = deriveComplianceStatus(data.kycStatus);

  customer.onboardingStatus = newOnboardingStatus;
  customer.complianceStatus = newComplianceStatus;
  customer.lastReviewedAt = now;
  customer.updatedAt = now;

  store.set(customerId, customer);

  // Emit kyc_completed when APPROVED
  if (data.kycStatus === 'APPROVED' && previousKycStatus !== 'APPROVED') {
    publishEvent('customer.kyc_completed', {
      eventType: 'customer.kyc_completed',
      customerId: customer.customerId,
      kycStatus: customer.kycStatus,
      kycCompletedAt: customer.kycCompletedAt,
      verificationProvider: customer.verificationProvider,
      verificationReference: customer.verificationReference,
      timestamp: now,
    });
  }

  // Emit status_changed when onboarding or compliance status transitions
  if (newOnboardingStatus !== previousOnboardingStatus) {
    publishEvent('customer.status_changed', {
      eventType: 'customer.status_changed',
      customerId: customer.customerId,
      field: 'onboardingStatus',
      previousValue: previousOnboardingStatus,
      newValue: newOnboardingStatus,
      reason: `KYC status changed to ${data.kycStatus}`,
      changedAt: now,
      timestamp: now,
    });
  }

  if (newComplianceStatus !== previousComplianceStatus) {
    publishEvent('customer.status_changed', {
      eventType: 'customer.status_changed',
      customerId: customer.customerId,
      field: 'complianceStatus',
      previousValue: previousComplianceStatus,
      newValue: newComplianceStatus,
      reason: `KYC status changed to ${data.kycStatus}`,
      changedAt: now,
      timestamp: now,
    });
  }

  return {
    customerId: customer.customerId,
    kycStatus: customer.kycStatus,
    kycCompletedAt: customer.kycCompletedAt,
    verificationProvider: customer.verificationProvider,
    verificationReference: customer.verificationReference,
    notes: customer.kycNotes,
    onboardingStatus: customer.onboardingStatus,
    complianceStatus: customer.complianceStatus,
    updatedAt: customer.updatedAt,
  };
}

/**
 * Get AML and compliance standing for a customer.
 *
 * @param {string} customerId
 * @returns {Promise<object>}
 */
async function getComplianceStatus(customerId) {
  const customer = store.get(customerId);
  if (!customer) throw notFound(customerId);

  return {
    customerId: customer.customerId,
    complianceStatus: customer.complianceStatus,
    amlStatus: customer.amlStatus,
    sanctionsScreeningStatus: customer.sanctionsScreeningStatus,
    lastReviewedAt: customer.lastReviewedAt,
    riskRating: customer.riskRating,
    flags: customer.complianceFlags,
  };
}

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Remove sensitive fields before returning a customer to callers.
 * SSN is never returned — only the last 4 digits are exposed.
 *
 * @param {object} customer - Raw customer record from the store
 * @returns {object} Safe customer object
 */
function sanitizeCustomer(customer) {
  const {
    // strip raw SSN if it ever ends up here (it shouldn't, but guard anyway)
    // eslint-disable-next-line no-unused-vars
    ssn: _ssn,
    // expose the rest
    customerId,
    firstName,
    lastName,
    email,
    phoneNumber,
    dateOfBirth,
    ssnLast4,
    address,
    nationality,
    employmentStatus,
    annualIncome,
    kycStatus,
    kycCompletedAt,
    verificationProvider,
    verificationReference,
    kycNotes,
    complianceStatus,
    amlStatus,
    sanctionsScreeningStatus,
    riskRating,
    complianceFlags,
    lastReviewedAt,
    onboardingStatus,
    createdAt,
    updatedAt,
  } = customer;

  return {
    customerId,
    firstName,
    lastName,
    email,
    phoneNumber,
    dateOfBirth,
    ssnLast4,
    address,
    nationality,
    employmentStatus,
    annualIncome,
    kycStatus,
    kycCompletedAt,
    verificationProvider,
    verificationReference,
    kycNotes,
    complianceStatus,
    amlStatus,
    sanctionsScreeningStatus,
    riskRating,
    complianceFlags,
    lastReviewedAt,
    onboardingStatus,
    createdAt,
    updatedAt,
  };
}

module.exports = {
  createCustomer,
  getCustomer,
  updateCustomer,
  updateKycStatus,
  getComplianceStatus,
};
