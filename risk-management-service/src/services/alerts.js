'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store of risk breach alerts.
 * Keyed by breachId.
 *
 * @type {Map<string, object>}
 */
const breachStore = new Map();

// Pre-seed with realistic breach examples covering various scenarios.
const seedBreaches = [
  {
    breachId: uuidv4(),
    accountId: 'acc-002',
    breachType: 'POSITION_LIMIT_EXCEEDED',
    severity: 'HIGH',
    limitName: 'maxPositionSizePct',
    limitValue: 0.25,
    currentValue: 0.31,
    symbol: 'AAPL',
    description: 'AAPL position represents 31% of portfolio, exceeding the 25% single-position limit.',
    status: 'ACTIVE',
    detectedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    acknowledgedAt: null,
    resolvedAt: null,
  },
  {
    breachId: uuidv4(),
    accountId: 'acc-002',
    breachType: 'SECTOR_CONCENTRATION_EXCEEDED',
    severity: 'MEDIUM',
    limitName: 'maxSectorConcentrationPct',
    limitValue: 0.40,
    currentValue: 0.62,
    symbol: null,
    sector: 'TECHNOLOGY',
    description: 'Technology sector allocation at 62%, exceeding the 40% sector concentration limit.',
    status: 'ACTIVE',
    detectedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    acknowledgedAt: null,
    resolvedAt: null,
  },
  {
    breachId: uuidv4(),
    accountId: 'acc-003',
    breachType: 'DAILY_LOSS_LIMIT_EXCEEDED',
    severity: 'CRITICAL',
    limitName: 'dailyLossLimit',
    limitValue: 50000.0,
    currentValue: 58230.5,
    symbol: null,
    description: 'Daily realized + unrealized losses of $58,230.50 exceed the $50,000 daily loss limit.',
    status: 'ACKNOWLEDGED',
    detectedAt: new Date(Date.now() - 1800000).toISOString(), // 30 min ago
    acknowledgedAt: new Date(Date.now() - 900000).toISOString(), // 15 min ago
    resolvedAt: null,
  },
  {
    breachId: uuidv4(),
    accountId: 'acc-005',
    breachType: 'LEVERAGE_LIMIT_EXCEEDED',
    severity: 'HIGH',
    limitName: 'maxLeverageRatio',
    limitValue: 2.0,
    currentValue: 2.38,
    symbol: null,
    description: 'Portfolio leverage ratio of 2.38× exceeds the maximum permitted leverage of 2.0×.',
    status: 'RESOLVED',
    detectedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    acknowledgedAt: new Date(Date.now() - 82800000).toISOString(),
    resolvedAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

// Populate the store with seed data
seedBreaches.forEach((b) => breachStore.set(b.breachId, b));

/**
 * Retrieve all current risk breach alerts, with optional filtering.
 *
 * @param {{ accountId?: string|null, severity?: string|null, status?: string|null }} filters
 * @returns {Promise<object>}
 */
async function getRiskBreaches({ accountId = null, severity = null, status = null } = {}) {
  let breaches = Array.from(breachStore.values());

  if (accountId) {
    breaches = breaches.filter((b) => b.accountId === accountId);
  }
  if (severity) {
    breaches = breaches.filter((b) => b.severity === severity);
  }
  if (status) {
    breaches = breaches.filter((b) => b.status === status);
  }

  const totalActive = breaches.filter((b) => b.status === 'ACTIVE').length;
  const totalCritical = breaches.filter((b) => b.severity === 'CRITICAL' && b.status === 'ACTIVE').length;

  return {
    breaches: breaches.map((b) => ({ ...b })),
    totalActive,
    totalCritical,
    asOf: new Date().toISOString(),
    filters: {
      accountId: accountId || 'ALL',
      severity: severity || 'ALL',
      status: status || 'ALL',
    },
  };
}

/**
 * Create a new risk breach alert record.
 *
 * @param {object} breachData
 * @param {string} breachData.accountId
 * @param {string} breachData.breachType
 * @param {string} breachData.severity — CRITICAL | HIGH | MEDIUM | LOW
 * @param {string} breachData.limitName
 * @param {number} breachData.limitValue
 * @param {number} breachData.currentValue
 * @param {string} [breachData.symbol]
 * @param {string} [breachData.sector]
 * @param {string} breachData.description
 * @returns {Promise<object>}
 */
async function createBreach(breachData) {
  const breachId = uuidv4();
  const now = new Date().toISOString();

  const breach = {
    breachId,
    accountId: breachData.accountId,
    breachType: breachData.breachType,
    severity: breachData.severity,
    limitName: breachData.limitName,
    limitValue: breachData.limitValue,
    currentValue: breachData.currentValue,
    symbol: breachData.symbol || null,
    sector: breachData.sector || null,
    description: breachData.description,
    status: 'ACTIVE',
    detectedAt: now,
    acknowledgedAt: null,
    resolvedAt: null,
  };

  breachStore.set(breachId, breach);

  // Simulate emitting risk.limit_breached event
  console.info('[event] risk.limit_breached', {
    eventId: uuidv4(),
    accountId: breach.accountId,
    breachType: breach.breachType,
    limitName: breach.limitName,
    limitValue: breach.limitValue,
    currentValue: breach.currentValue,
    symbol: breach.symbol,
    severity: breach.severity,
    detectedAt: now,
  });

  return { ...breach };
}

/**
 * Acknowledge an active breach alert.
 *
 * @param {string} breachId
 * @returns {Promise<object>}
 */
async function acknowledgeBreach(breachId) {
  const breach = breachStore.get(breachId);
  if (!breach) {
    const err = new Error(`Breach ${breachId} not found`);
    err.status = 404;
    throw err;
  }
  if (breach.status !== 'ACTIVE') {
    const err = new Error(`Breach ${breachId} is not in ACTIVE status`);
    err.status = 409;
    throw err;
  }

  breach.status = 'ACKNOWLEDGED';
  breach.acknowledgedAt = new Date().toISOString();
  breachStore.set(breachId, breach);
  return { ...breach };
}

/**
 * Resolve a breach alert (mark as remediated).
 *
 * @param {string} breachId
 * @returns {Promise<object>}
 */
async function resolveBreach(breachId) {
  const breach = breachStore.get(breachId);
  if (!breach) {
    const err = new Error(`Breach ${breachId} not found`);
    err.status = 404;
    throw err;
  }
  if (breach.status === 'RESOLVED') {
    const err = new Error(`Breach ${breachId} is already resolved`);
    err.status = 409;
    throw err;
  }

  breach.status = 'RESOLVED';
  breach.resolvedAt = new Date().toISOString();
  breachStore.set(breachId, breach);
  return { ...breach };
}

/**
 * Retrieve a single breach record by ID.
 *
 * @param {string} breachId
 * @returns {Promise<object>}
 */
async function getBreach(breachId) {
  const breach = breachStore.get(breachId);
  if (!breach) {
    const err = new Error(`Breach ${breachId} not found`);
    err.status = 404;
    throw err;
  }
  return { ...breach };
}

/**
 * Emit a risk exposure warning (simulated — logs to stdout).
 *
 * @param {object} warningData
 * @param {string} warningData.accountId
 * @param {string} warningData.warningType
 * @param {number} warningData.currentConcentration
 * @param {number} warningData.thresholdPct
 * @param {string} warningData.affectedSymbol
 */
function emitExposureWarning(warningData) {
  const event = {
    eventId: uuidv4(),
    accountId: warningData.accountId,
    warningType: warningData.warningType,
    currentConcentration: warningData.currentConcentration,
    thresholdPct: warningData.thresholdPct,
    affectedSymbol: warningData.affectedSymbol,
    issuedAt: new Date().toISOString(),
  };
  console.info('[event] risk.exposure_warning', event);
  return event;
}

module.exports = {
  getRiskBreaches,
  createBreach,
  acknowledgeBreach,
  resolveBreach,
  getBreach,
  emitExposureWarning,
};
