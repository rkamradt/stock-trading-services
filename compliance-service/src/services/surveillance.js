'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store for detected surveillance patterns.
 * @type {Map<string, Object>}
 */
const surveillancePatterns = new Map();

// Seed with example surveillance data
(function seedPatterns() {
  const seed = [
    {
      patternId: 'pat-001',
      patternType: 'WASH_TRADING',
      accountId: 'acct-009',
      detectedAt: '2024-01-18T11:00:00.000Z',
      severity: 'HIGH',
      description: 'Account executed offsetting buy/sell transactions in TSLA within a 2-minute window on multiple occasions.',
      involvedOrders: ['ord-100', 'ord-101', 'ord-102'],
      involvedSymbols: ['TSLA'],
      patternScore: 0.89,
      status: 'UNDER_REVIEW',
      assignedTo: 'surveillance-analyst@firm.com',
      notes: 'Initial review started. Awaiting account holder response.',
      resolvedAt: null,
      createdAt: '2024-01-18T11:00:00.000Z',
      updatedAt: '2024-01-18T15:30:00.000Z',
    },
    {
      patternId: 'pat-002',
      patternType: 'LAYERING',
      accountId: 'acct-012',
      detectedAt: '2024-01-25T09:45:00.000Z',
      severity: 'CRITICAL',
      description: 'Large volumes of AMZN limit orders placed and cancelled repeatedly within milliseconds, consistent with layering behavior.',
      involvedOrders: ['ord-200', 'ord-201', 'ord-202', 'ord-203'],
      involvedSymbols: ['AMZN'],
      patternScore: 0.95,
      status: 'ESCALATED',
      assignedTo: 'senior-compliance@firm.com',
      notes: 'Escalated to enforcement team. Trading suspended pending investigation.',
      resolvedAt: null,
      createdAt: '2024-01-25T09:45:00.000Z',
      updatedAt: '2024-01-25T14:00:00.000Z',
    },
    {
      patternId: 'pat-003',
      patternType: 'FRONT_RUNNING',
      accountId: 'acct-015',
      detectedAt: '2024-02-01T13:20:00.000Z',
      severity: 'MEDIUM',
      description: 'Account placed buy orders in NVDA immediately before a large institutional client order was submitted.',
      involvedOrders: ['ord-300', 'ord-301'],
      involvedSymbols: ['NVDA'],
      patternScore: 0.71,
      status: 'DETECTED',
      assignedTo: null,
      notes: null,
      resolvedAt: null,
      createdAt: '2024-02-01T13:20:00.000Z',
      updatedAt: '2024-02-01T13:20:00.000Z',
    },
  ];
  seed.forEach((p) => surveillancePatterns.set(p.patternId, p));
})();

/**
 * Get surveillance patterns with optional filtering.
 *
 * @param {Object} filters
 * @param {string} [filters.patternType]
 * @param {string} [filters.accountId]
 * @param {string} [filters.fromDate]
 * @param {string} [filters.toDate]
 * @param {string} [filters.status]
 * @param {string} [filters.severity]
 * @param {number} [filters.limit]
 * @param {number} [filters.offset]
 * @returns {Promise<Object>}
 */
async function getSurveillancePatterns(filters = {}) {
  const { patternType, accountId, fromDate, toDate, status, severity, limit = 50, offset = 0 } = filters;

  let patterns = Array.from(surveillancePatterns.values());

  if (patternType) {
    patterns = patterns.filter((p) => p.patternType === patternType);
  }
  if (accountId) {
    patterns = patterns.filter((p) => p.accountId === accountId);
  }
  if (fromDate) {
    const from = new Date(fromDate);
    patterns = patterns.filter((p) => new Date(p.detectedAt) >= from);
  }
  if (toDate) {
    const to = new Date(toDate);
    patterns = patterns.filter((p) => new Date(p.detectedAt) <= to);
  }
  if (status) {
    patterns = patterns.filter((p) => p.status === status);
  }
  if (severity) {
    patterns = patterns.filter((p) => p.severity === severity);
  }

  const total = patterns.length;
  const paginated = patterns
    .sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt))
    .slice(offset, offset + limit);

  return {
    total,
    limit,
    offset,
    patterns: paginated,
  };
}

/**
 * Record a newly detected surveillance pattern.
 *
 * @param {Object} pattern
 * @returns {Promise<Object>}
 */
async function createSurveillancePattern(pattern) {
  const patternId = `pat-${uuidv4()}`;
  const now = new Date().toISOString();
  const entry = {
    patternId,
    patternType: pattern.patternType,
    accountId: pattern.accountId,
    detectedAt: now,
    severity: pattern.severity || 'MEDIUM',
    description: pattern.description,
    involvedOrders: pattern.involvedOrders || [],
    involvedSymbols: pattern.involvedSymbols || [],
    patternScore: pattern.patternScore || null,
    status: 'DETECTED',
    assignedTo: null,
    notes: null,
    resolvedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  surveillancePatterns.set(patternId, entry);

  // Emit compliance.violation_detected for confirmed or high-severity patterns
  if (entry.severity === 'CRITICAL' || entry.severity === 'HIGH') {
    emitEvent('compliance.violation_detected', {
      violationId: `vio-${uuidv4()}`,
      ruleId: `rule-${entry.patternType.toLowerCase().replace(/_/g, '-')}`,
      ruleName: entry.patternType,
      entityId: entry.accountId,
      entityType: 'ACCOUNT',
      severity: entry.severity,
      detectedAt: now,
      description: entry.description,
      evidence: { patternId, involvedOrders: entry.involvedOrders },
    });
  }

  return entry;
}

/**
 * Update the status or assignment of a surveillance pattern.
 *
 * @param {string} patternId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
async function updateSurveillancePattern(patternId, updates) {
  const pattern = surveillancePatterns.get(patternId);
  if (!pattern) {
    const err = new Error(`Surveillance pattern '${patternId}' not found`);
    err.status = 404;
    throw err;
  }

  const updated = {
    ...pattern,
    ...updates,
    patternId,
    updatedAt: new Date().toISOString(),
  };

  surveillancePatterns.set(patternId, updated);
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
  getSurveillancePatterns,
  createSurveillancePattern,
  updateSurveillancePattern,
};
