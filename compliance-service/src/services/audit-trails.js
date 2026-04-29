'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store for audit trail entries keyed by entityId.
 * @type {Map<string, Object[]>}
 */
const auditTrailsByEntity = new Map();

// Seed with example data
(function seedAuditTrails() {
  const entries = [
    {
      trailId: 'trail-001',
      entityId: 'cust-001',
      action: 'KYC_VERIFIED',
      performedBy: 'kyc-service@firm.com',
      timestamp: '2024-01-15T10:30:00.000Z',
      resourceType: 'CUSTOMER',
      resourceId: 'cust-001',
      details: { previousStatus: 'PENDING', newStatus: 'VERIFIED' },
      ipAddress: '192.168.1.101',
      sessionId: 'sess-aaa111',
      outcome: 'SUCCESS',
    },
    {
      trailId: 'trail-002',
      entityId: 'acct-001',
      action: 'TRADE_SUBMITTED',
      performedBy: 'trader@firm.com',
      timestamp: '2024-01-20T14:22:00.000Z',
      resourceType: 'ORDER',
      resourceId: 'ord-001',
      details: { symbol: 'AAPL', quantity: 500, orderType: 'MARKET', side: 'BUY' },
      ipAddress: '10.0.0.55',
      sessionId: 'sess-bbb222',
      outcome: 'SUCCESS',
    },
    {
      trailId: 'trail-003',
      entityId: 'acct-001',
      action: 'WITHDRAWAL_PROCESSED',
      performedBy: 'ops-team@firm.com',
      timestamp: '2024-01-22T09:00:00.000Z',
      resourceType: 'ACCOUNT',
      resourceId: 'acct-001',
      details: { amount: 50000, currency: 'USD', destinationBank: 'CHASE' },
      ipAddress: '10.0.0.60',
      sessionId: 'sess-ccc333',
      outcome: 'SUCCESS',
    },
  ];

  entries.forEach((e) => {
    if (!auditTrailsByEntity.has(e.entityId)) {
      auditTrailsByEntity.set(e.entityId, []);
    }
    auditTrailsByEntity.get(e.entityId).push(e);
  });
})();

/**
 * Retrieve audit trails for a given entity with optional filtering.
 *
 * @param {string} entityId
 * @param {Object} filters
 * @param {string} [filters.fromDate]
 * @param {string} [filters.toDate]
 * @param {string} [filters.action]
 * @param {string} [filters.resourceType]
 * @param {number} [filters.limit]
 * @param {number} [filters.offset]
 * @returns {Promise<Object>}
 */
async function getAuditTrails(entityId, filters = {}) {
  const { fromDate, toDate, action, resourceType, limit = 100, offset = 0 } = filters;

  let trails = auditTrailsByEntity.get(entityId) || [];

  if (fromDate) {
    const from = new Date(fromDate);
    trails = trails.filter((t) => new Date(t.timestamp) >= from);
  }
  if (toDate) {
    const to = new Date(toDate);
    trails = trails.filter((t) => new Date(t.timestamp) <= to);
  }
  if (action) {
    trails = trails.filter((t) => t.action === action);
  }
  if (resourceType) {
    trails = trails.filter((t) => t.resourceType === resourceType);
  }

  const total = trails.length;
  const paginated = trails
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(offset, offset + limit);

  return {
    entityId,
    total,
    limit,
    offset,
    trails: paginated,
  };
}

/**
 * Record a new audit trail entry for an entity.
 *
 * @param {string} entityId
 * @param {Object} entry
 * @param {string} entry.action
 * @param {string} entry.performedBy
 * @param {string} entry.resourceType
 * @param {string} entry.resourceId
 * @param {Object} [entry.details]
 * @param {string} [entry.ipAddress]
 * @param {string} [entry.sessionId]
 * @param {string} [entry.outcome]
 * @returns {Promise<Object>}
 */
async function recordAuditEntry(entityId, entry) {
  const trailEntry = {
    trailId: `trail-${uuidv4()}`,
    entityId,
    action: entry.action,
    performedBy: entry.performedBy,
    timestamp: new Date().toISOString(),
    resourceType: entry.resourceType,
    resourceId: entry.resourceId,
    details: entry.details || {},
    ipAddress: entry.ipAddress || null,
    sessionId: entry.sessionId || null,
    outcome: entry.outcome || 'SUCCESS',
  };

  if (!auditTrailsByEntity.has(entityId)) {
    auditTrailsByEntity.set(entityId, []);
  }
  auditTrailsByEntity.get(entityId).push(trailEntry);

  return trailEntry;
}

/**
 * Get all audit trail entries across all entities (admin view).
 * @returns {Promise<Object[]>}
 */
async function listAllAuditEntries() {
  const all = [];
  for (const entries of auditTrailsByEntity.values()) {
    all.push(...entries);
  }
  return all.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

module.exports = {
  getAuditTrails,
  recordAuditEntry,
  listAllAuditEntries,
};
