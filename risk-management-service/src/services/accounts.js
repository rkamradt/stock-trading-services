'use strict';

const { v4: uuidv4 } = require('uuid');
const tradesService = require('./trades');

/**
 * In-memory store for account risk metrics snapshots.
 * Keyed by accountId.
 *
 * @type {Map<string, object>}
 */
const riskMetricsStore = new Map([
  [
    'acc-001',
    {
      accountId: 'acc-001',
      riskScore: 38,
      portfolioBeta: 0.95,
      sharpeRatio: 1.82,
      maxDrawdown: -0.05,
      dailyVaR: 3200.0,
      concentrationRisk: {
        topHoldingPct: 0.18,
        sectorConcentrations: {
          TECHNOLOGY: 0.35,
          HEALTHCARE: 0.22,
          FINANCIALS: 0.18,
          CONSUMER_DISCRETIONARY: 0.15,
          OTHER: 0.10,
        },
      },
      leverageRatio: 1.0,
      openRiskLimitBreaches: 0,
      lastCalculatedAt: new Date().toISOString(),
    },
  ],
  [
    'acc-002',
    {
      accountId: 'acc-002',
      riskScore: 77,
      portfolioBeta: 1.45,
      sharpeRatio: 0.92,
      maxDrawdown: -0.14,
      dailyVaR: 18500.0,
      concentrationRisk: {
        topHoldingPct: 0.31,
        sectorConcentrations: {
          TECHNOLOGY: 0.62,
          ENERGY: 0.22,
          OTHER: 0.16,
        },
      },
      leverageRatio: 1.80,
      openRiskLimitBreaches: 2,
      lastCalculatedAt: new Date().toISOString(),
    },
  ],
]);

/**
 * In-memory store for account risk limit configurations.
 * Keyed by accountId.
 *
 * @type {Map<string, object>}
 */
const riskLimitsStore = new Map();

/**
 * Retrieve current risk metrics for an account.
 * Returns a freshly timestamped snapshot if the account exists; creates
 * a default snapshot for unknown accounts.
 *
 * @param {string} accountId
 * @returns {Promise<object>}
 */
async function getRiskMetrics(accountId) {
  if (!riskMetricsStore.has(accountId)) {
    // Create a default metrics record for the account on first access
    const defaults = {
      accountId,
      riskScore: 0,
      portfolioBeta: 1.0,
      sharpeRatio: 0.0,
      maxDrawdown: 0.0,
      dailyVaR: 0.0,
      concentrationRisk: {
        topHoldingPct: 0.0,
        sectorConcentrations: {},
      },
      leverageRatio: 1.0,
      openRiskLimitBreaches: 0,
      lastCalculatedAt: new Date().toISOString(),
    };
    riskMetricsStore.set(accountId, defaults);
  }

  const metrics = riskMetricsStore.get(accountId);
  // Refresh the timestamp to indicate the data was just fetched
  metrics.lastCalculatedAt = new Date().toISOString();
  return { ...metrics };
}

/**
 * Set or update risk limits and thresholds for an account.
 * Merges the incoming payload with any existing limits, applying partial updates.
 *
 * @param {string} accountId
 * @param {object} limitsPayload
 * @returns {Promise<object>}
 */
async function updateRiskLimits(accountId, limitsPayload) {
  const existingLimits = riskLimitsStore.get(accountId) || { ...tradesService.DEFAULT_RISK_LIMITS };

  const merged = {
    ...existingLimits,
    ...Object.fromEntries(
      Object.entries(limitsPayload).filter(([, v]) => v !== undefined)
    ),
  };

  riskLimitsStore.set(accountId, merged);
  // Keep the trades service in sync so risk checks use the updated limits
  tradesService.setAccountLimits(accountId, merged);

  const updatedAt = new Date().toISOString();

  return {
    accountId,
    riskLimits: { ...merged },
    updatedAt,
    updatedBy: 'system',
  };
}

/**
 * Retrieve the configured risk limits for an account.
 * Returns platform defaults if no custom limits have been set.
 *
 * @param {string} accountId
 * @returns {Promise<object>}
 */
async function getRiskLimits(accountId) {
  const limits = riskLimitsStore.get(accountId) || { ...tradesService.DEFAULT_RISK_LIMITS };
  return {
    accountId,
    riskLimits: { ...limits },
    source: riskLimitsStore.has(accountId) ? 'account_specific' : 'platform_default',
  };
}

/**
 * Update the in-memory risk metrics snapshot for an account.
 * Used internally to reflect changes triggered by trades or market moves.
 *
 * @param {string} accountId
 * @param {Partial<object>} updates
 * @returns {Promise<object>}
 */
async function updateRiskMetrics(accountId, updates) {
  const existing = await getRiskMetrics(accountId);
  const updated = {
    ...existing,
    ...updates,
    lastCalculatedAt: new Date().toISOString(),
  };
  riskMetricsStore.set(accountId, updated);
  return { ...updated };
}

/**
 * List all accounts that have recorded risk metrics.
 *
 * @returns {Promise<object[]>}
 */
async function listAccountsWithMetrics() {
  return Array.from(riskMetricsStore.values()).map((m) => ({ ...m }));
}

module.exports = {
  getRiskMetrics,
  updateRiskLimits,
  getRiskLimits,
  updateRiskMetrics,
  listAccountsWithMetrics,
};
