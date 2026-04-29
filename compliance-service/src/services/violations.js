'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store for compliance violations.
 * @type {Map<string, Object>}
 */
const violations = new Map();

// Seed with example violation data
(function seedViolations() {
  const seed = [
    {
      violationId: 'vio-001',
      ruleId: 'rule-wash-trading',
      ruleName: 'Wash Trading Detection',
      entityId: 'acct-009',
      entityType: 'ACCOUNT',
      severity: 'HIGH',
      status: 'UNDER_REVIEW',
      detectedAt: '2024-01-18T11:00:00.000Z',
      description: 'Account executed offsetting buy/sell transactions in TSLA within a 2-minute window on 4 occasions.',
      evidence: {
        patternId: 'pat-001',
        involvedOrders: ['ord-100', 'ord-101', 'ord-102'],
        symbol: 'TSLA',
        transactionCount: 4,
        totalValue: 240000,
      },
      assignedTo: 'surveillance-analyst@firm.com',
      notes: 'Customer notified. Awaiting written explanation.',
      remediationActions: ['ACCOUNT_RESTRICTED'],
      resolvedAt: null,
      resolvedBy: null,
      resolutionNotes: null,
      createdAt: '2024-01-18T11:00:00.000Z',
      updatedAt: '2024-01-18T15:30:00.000Z',
    },
    {
      violationId: 'vio-002',
      ruleId: 'rule-layering',
      ruleName: 'Layering / Spoofing Detection',
      entityId: 'acct-012',
      entityType: 'ACCOUNT',
      severity: 'CRITICAL',
      status: 'ESCALATED',
      detectedAt: '2024-01-25T09:45:00.000Z',
      description: 'Account placed and cancelled 47 large AMZN limit orders within 90 seconds, consistent with layering.',
      evidence: {
        patternId: 'pat-002',
        involvedOrders: ['ord-200', 'ord-201', 'ord-202', 'ord-203'],
        symbol: 'AMZN',
        cancellationRate: 0.96,
        timeWindowSeconds: 90,
        estimatedMarketImpact: 'SIGNIFICANT',
      },
      assignedTo: 'senior-compliance@firm.com',
      notes: 'Trading suspended. SEC referral pending legal review.',
      remediationActions: ['TRADING_SUSPENDED', 'ACCOUNT_FROZEN'],
      resolvedAt: null,
      resolvedBy: null,
      resolutionNotes: null,
      createdAt: '2024-01-25T09:45:00.000Z',
      updatedAt: '2024-01-25T14:00:00.000Z',
    },
    {
      violationId: 'vio-003',
      ruleId: 'rule-concentration-limit',
      ruleName: 'Portfolio Concentration Limit',
      entityId: 'acct-020',
      entityType: 'ACCOUNT',
      severity: 'MEDIUM',
      status: 'RESOLVED',
      detectedAt: '2024-02-10T08:00:00.000Z',
      description: 'Single-security concentration in NVDA reached 38% of total portfolio value, exceeding 25% limit.',
      evidence: {
        symbol: 'NVDA',
        concentrationPercentage: 0.38,
        thresholdPercentage: 0.25,
        portfolioValue: 520000,
        positionValue: 197600,
      },
      assignedTo: 'compliance-officer@firm.com',
      notes: 'Customer contacted and rebalancing plan established.',
      remediationActions: ['CUSTOMER_NOTIFIED', 'REBALANCING_REQUIRED'],
      resolvedAt: '2024-02-15T10:00:00.000Z',
      resolvedBy: 'compliance-officer@firm.com',
      resolutionNotes: 'Customer reduced NVDA position to 22% of portfolio. Violation cleared.',
      createdAt: '2024-02-10T08:00:00.000Z',
      updatedAt: '2024-02-15T10:00:00.000Z',
    },
    {
      violationId: 'vio-004',
      ruleId: 'rule-aml-structuring',
      ruleName: 'AML Structuring Detection',
      entityId: 'cust-050',
      entityType: 'CUSTOMER',
      severity: 'CRITICAL',
      status: 'ESCALATED',
      detectedAt: '2024-01-04T06:00:00.000Z',
      description: '12 cash deposits of $9,900 detected over 30-day window, consistent with CTR avoidance structuring.',
      evidence: {
        transactionCount: 12,
        averageTransactionAmount: 9900,
        totalAmount: 118800,
        periodDays: 30,
        ctrThreshold: 10000,
      },
      assignedTo: 'aml-officer@firm.com',
      notes: 'SAR filed with FinCEN. Account activity restricted pending investigation.',
      remediationActions: ['SAR_FILED', 'ACCOUNT_RESTRICTED', 'CUSTOMER_FLAGGED'],
      resolvedAt: null,
      resolvedBy: null,
      resolutionNotes: null,
      createdAt: '2024-01-04T06:00:00.000Z',
      updatedAt: '2024-01-05T09:00:00.000Z',
    },
  ];
  seed.forEach((v) => violations.set(v.violationId, v));
})();

/**
 * Get compliance violations with optional filtering.
 *
 * @param {Object} filters
 * @param {string} [filters.accountId]
 * @param {string} [filters.severity]
 * @param {string} [filters.status]
 * @param {string} [filters.fromDate]
 * @param {string} [filters.toDate]
 * @param {string} [filters.ruleId]
 * @param {string} [filters.entityType]
 * @param {number} [filters.limit]
 * @param {number} [filters.offset]
 * @returns {Promise<Object>}
 */
async function getViolations(filters = {}) {
  const { accountId, severity, status, fromDate, toDate, ruleId, entityType, limit = 50, offset = 0 } = filters;

  let list = Array.from(violations.values());

  if (accountId) list = list.filter((v) => v.entityId === accountId);
  if (severity) list = list.filter((v) => v.severity === severity);
  if (status) list = list.filter((v) => v.status === status);
  if (ruleId) list = list.filter((v) => v.ruleId === ruleId);
  if (entityType) list = list.filter((v) => v.entityType === entityType);
  if (fromDate) {
    const from = new Date(fromDate);
    list = list.filter((v) => new Date(v.detectedAt) >= from);
  }
  if (toDate) {
    const to = new Date(toDate);
    list = list.filter((v) => new Date(v.detectedAt) <= to);
  }

  const total = list.length;
  const paginated = list
    .sort((a, b) => {
      const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      const sev = (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4);
      if (sev !== 0) return sev;
      return new Date(b.detectedAt) - new Date(a.detectedAt);
    })
    .slice(offset, offset + limit);

  return {
    total,
    limit,
    offset,
    violations: paginated,
  };
}

/**
 * Create a new compliance violation record.
 *
 * @param {Object} params
 * @param {string} params.ruleId
 * @param {string} params.ruleName
 * @param {string} params.entityId
 * @param {string} params.entityType
 * @param {string} params.severity
 * @param {string} params.description
 * @param {Object} [params.evidence]
 * @returns {Promise<Object>}
 */
async function createViolation(params) {
  const violationId = `vio-${uuidv4()}`;
  const now = new Date().toISOString();

  const violation = {
    violationId,
    ruleId: params.ruleId,
    ruleName: params.ruleName,
    entityId: params.entityId,
    entityType: params.entityType,
    severity: params.severity || 'MEDIUM',
    status: 'OPEN',
    detectedAt: now,
    description: params.description,
    evidence: params.evidence || {},
    assignedTo: null,
    notes: null,
    remediationActions: [],
    resolvedAt: null,
    resolvedBy: null,
    resolutionNotes: null,
    createdAt: now,
    updatedAt: now,
  };

  violations.set(violationId, violation);

  // Emit compliance.violation_detected event
  emitEvent('compliance.violation_detected', {
    violationId,
    ruleId: violation.ruleId,
    ruleName: violation.ruleName,
    entityId: violation.entityId,
    entityType: violation.entityType,
    severity: violation.severity,
    detectedAt: now,
    description: violation.description,
    evidence: violation.evidence,
  });

  return violation;
}

/**
 * Update the status or assignment of a violation.
 *
 * @param {string} violationId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
async function updateViolation(violationId, updates) {
  const violation = violations.get(violationId);
  if (!violation) {
    const err = new Error(`Compliance violation '${violationId}' not found`);
    err.status = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const updated = {
    ...violation,
    ...updates,
    violationId,
    updatedAt: now,
  };

  violations.set(violationId, updated);
  return updated;
}

/**
 * Resolve a compliance violation.
 *
 * @param {string} violationId
 * @param {string} resolvedBy
 * @param {string} resolutionNotes
 * @returns {Promise<Object>}
 */
async function resolveViolation(violationId, resolvedBy, resolutionNotes) {
  const violation = violations.get(violationId);
  if (!violation) {
    const err = new Error(`Compliance violation '${violationId}' not found`);
    err.status = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const resolved = {
    ...violation,
    status: 'RESOLVED',
    resolvedAt: now,
    resolvedBy,
    resolutionNotes,
    updatedAt: now,
  };

  violations.set(violationId, resolved);
  return resolved;
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
  getViolations,
  createViolation,
  updateViolation,
  resolveViolation,
};
