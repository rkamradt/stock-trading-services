'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store for Suspicious Activity Reports (SARs).
 * @type {Map<string, Object>}
 */
const sarReports = new Map();

// Seed with example data
(function seedSARs() {
  const seed = [
    {
      sarId: 'sar-001',
      subjectEntityId: 'cust-050',
      subjectEntityType: 'CUSTOMER',
      activityType: 'STRUCTURING',
      activityDescription:
        'Customer made 12 cash deposits of $9,900 each over 30 days, structured to avoid CTR reporting thresholds.',
      activityDateStart: '2023-12-01T00:00:00.000Z',
      activityDateEnd: '2023-12-31T23:59:59.000Z',
      transactionIds: ['txn-001', 'txn-002', 'txn-003'],
      amount: 118800,
      currency: 'USD',
      filedBy: 'aml-officer@firm.com',
      narrativeSummary:
        'Subject engaged in a pattern of deposits consistently below the $10,000 CTR threshold. Behavior is consistent with structuring in violation of 31 U.S.C. § 5324. Twelve deposits totaling $118,800 across 30 days. Referred to FinCEN for further investigation.',
      filingStatus: 'SUBMITTED',
      filedAt: '2024-01-05T09:00:00.000Z',
      referenceNumber: 'SAR-FINCEN-2024-0105-00001',
      acknowledgmentExpected: '2024-01-12T09:00:00.000Z',
      acknowledgmentReceived: null,
      regulatoryBody: 'FinCEN',
      createdAt: '2024-01-05T09:00:00.000Z',
      updatedAt: '2024-01-05T09:00:00.000Z',
    },
    {
      sarId: 'sar-002',
      subjectEntityId: 'acct-077',
      subjectEntityType: 'ACCOUNT',
      activityType: 'MARKET_MANIPULATION',
      activityDescription:
        'Account executed a series of coordinated trades in thinly traded micro-cap security XYZ Corp designed to artificially inflate price.',
      activityDateStart: '2024-01-08T00:00:00.000Z',
      activityDateEnd: '2024-01-10T23:59:59.000Z',
      transactionIds: ['txn-010', 'txn-011', 'txn-012', 'txn-013'],
      amount: 450000,
      currency: 'USD',
      filedBy: 'compliance-director@firm.com',
      narrativeSummary:
        'Account participated in a coordinated scheme to inflate the price of XYZC (micro-cap) through a series of wash trades and matched orders over a 3-day period. Price increased 340% with no corresponding news or fundamental change. Four related accounts identified. Referral to SEC Division of Enforcement recommended.',
      filingStatus: 'DRAFT',
      filedAt: null,
      referenceNumber: null,
      acknowledgmentExpected: null,
      acknowledgmentReceived: null,
      regulatoryBody: 'SEC',
      createdAt: '2024-01-11T14:00:00.000Z',
      updatedAt: '2024-01-11T14:00:00.000Z',
    },
  ];
  seed.forEach((s) => sarReports.set(s.sarId, s));
})();

/**
 * File a new Suspicious Activity Report (SAR).
 *
 * @param {Object} params
 * @param {string} params.subjectEntityId
 * @param {string} params.subjectEntityType
 * @param {string} params.activityType
 * @param {string} params.activityDescription
 * @param {string} params.activityDateStart
 * @param {string} params.activityDateEnd
 * @param {string[]} [params.transactionIds]
 * @param {number} params.amount
 * @param {string} params.currency
 * @param {string} params.filedBy
 * @param {string} params.narrativeSummary
 * @returns {Promise<Object>}
 */
async function fileSAR(params) {
  const {
    subjectEntityId,
    subjectEntityType,
    activityType,
    activityDescription,
    activityDateStart,
    activityDateEnd,
    transactionIds = [],
    amount,
    currency,
    filedBy,
    narrativeSummary,
  } = params;

  const startDate = new Date(activityDateStart);
  const endDate = new Date(activityDateEnd);
  if (endDate < startDate) {
    const err = new Error('activityDateEnd must be on or after activityDateStart');
    err.status = 400;
    throw err;
  }

  const sarId = `sar-${uuidv4()}`;
  const now = new Date().toISOString();
  const year = new Date().getFullYear();

  const regulatoryBodyMap = {
    STRUCTURING: 'FinCEN',
    MONEY_LAUNDERING: 'FinCEN',
    INSIDER_TRADING: 'SEC',
    MARKET_MANIPULATION: 'SEC',
    FRAUD: 'FINRA',
    IDENTITY_THEFT: 'FinCEN',
    TAX_EVASION: 'IRS',
    TERRORIST_FINANCING: 'FinCEN',
    OTHER: 'FinCEN',
  };

  const regulatoryBody = regulatoryBodyMap[activityType] || 'FinCEN';
  const referenceNumber = `SAR-${regulatoryBody.toUpperCase()}-${year}-${now.slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;

  const acknowledgmentExpected = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const sar = {
    sarId,
    subjectEntityId,
    subjectEntityType,
    activityType,
    activityDescription,
    activityDateStart,
    activityDateEnd,
    transactionIds,
    amount,
    currency,
    filedBy,
    narrativeSummary,
    filingStatus: 'SUBMITTED',
    filedAt: now,
    referenceNumber,
    acknowledgmentExpected,
    acknowledgmentReceived: null,
    regulatoryBody,
    createdAt: now,
    updatedAt: now,
  };

  sarReports.set(sarId, sar);

  // Emit compliance.sar_filed event
  emitEvent('compliance.sar_filed', {
    sarId,
    subjectEntityId,
    subjectEntityType,
    activityType,
    filedAt: now,
    referenceNumber,
  });

  // Also emit compliance.audit_required for internal tracking
  emitEvent('compliance.audit_required', {
    auditId: `aud-${uuidv4()}`,
    subjectEntityId,
    subjectEntityType,
    reason: `SAR filed for ${activityType} activity`,
    priority: ['MONEY_LAUNDERING', 'TERRORIST_FINANCING', 'INSIDER_TRADING'].includes(activityType) ? 'CRITICAL' : 'HIGH',
    requestedAt: now,
    requestedBy: filedBy,
  });

  return {
    sarId,
    subjectEntityId,
    activityType,
    filingStatus: 'SUBMITTED',
    filedAt: now,
    referenceNumber,
    acknowledgmentExpected,
  };
}

/**
 * Get a SAR by ID.
 *
 * @param {string} sarId
 * @returns {Promise<Object>}
 */
async function getSAR(sarId) {
  const sar = sarReports.get(sarId);
  if (!sar) {
    const err = new Error(`SAR '${sarId}' not found`);
    err.status = 404;
    throw err;
  }
  return sar;
}

/**
 * List all SARs with optional filtering.
 *
 * @param {Object} [filters]
 * @param {string} [filters.subjectEntityId]
 * @param {string} [filters.activityType]
 * @param {string} [filters.filingStatus]
 * @param {number} [filters.limit]
 * @param {number} [filters.offset]
 * @returns {Promise<Object>}
 */
async function listSARs(filters = {}) {
  const { subjectEntityId, activityType, filingStatus, limit = 50, offset = 0 } = filters;
  let sars = Array.from(sarReports.values());

  if (subjectEntityId) sars = sars.filter((s) => s.subjectEntityId === subjectEntityId);
  if (activityType) sars = sars.filter((s) => s.activityType === activityType);
  if (filingStatus) sars = sars.filter((s) => s.filingStatus === filingStatus);

  const total = sars.length;
  return {
    total,
    limit,
    offset,
    reports: sars.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(offset, offset + limit),
  };
}

/**
 * Update acknowledgment status of a SAR.
 *
 * @param {string} sarId
 * @param {string} acknowledgedAt
 * @returns {Promise<Object>}
 */
async function acknowledgeSAR(sarId, acknowledgedAt) {
  const sar = sarReports.get(sarId);
  if (!sar) {
    const err = new Error(`SAR '${sarId}' not found`);
    err.status = 404;
    throw err;
  }

  const updated = {
    ...sar,
    acknowledgmentReceived: acknowledgedAt || new Date().toISOString(),
    filingStatus: 'ACKNOWLEDGED',
    updatedAt: new Date().toISOString(),
  };

  sarReports.set(sarId, updated);
  return updated;
}

/**
 * Internal event emitter stub.
 * @param {string} topic
 * @param {Object} payload
 */
function emitEvent(topic, payload) {
  console.log(`[EVENT] ${topic}:`, JSON.stringify(payload));
}

module.exports = {
  fileSAR,
  getSAR,
  listSARs,
  acknowledgeSAR,
};
