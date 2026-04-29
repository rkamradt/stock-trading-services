'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store of risk check records.
 * Each entry captures the full context of a pre-trade risk validation.
 *
 * @type {Map<string, object>}
 */
const riskCheckStore = new Map();

// Pre-seeded risk limits used when no account-specific limits are found.
const DEFAULT_RISK_LIMITS = {
  maxPositionSizePct: 0.25,
  maxSectorConcentrationPct: 0.40,
  maxLeverageRatio: 2.0,
  dailyLossLimit: 50000.0,
  maxDrawdownPct: 0.15,
  maxOpenOrders: 100,
  allowedAssetClasses: ['EQUITY', 'OPTION', 'FUTURE', 'ETF'],
  maxSingleOrderNotional: 1000000.0,
};

// Simulated per-account risk limits overrides (populated via the accounts service).
const accountRiskLimits = new Map();

// Simulated in-memory state for current daily P&L per account.
const accountDailyPnL = new Map([
  ['acc-001', -2000.0],
  ['acc-002', -55000.0], // over daily loss limit for demo purposes
]);

/**
 * Determine the active risk limits for an account.
 * Falls back to platform defaults if no account-specific limits are configured.
 */
function getEffectiveLimits(accountId) {
  return accountRiskLimits.get(accountId) || { ...DEFAULT_RISK_LIMITS };
}

/**
 * Compute a heuristic risk score (0–100) for a proposed trade.
 * Higher scores indicate greater risk.
 */
function computeRiskScore(trade, limits) {
  let score = 0;

  // Notional size relative to single-order limit
  const notionalRatio = trade.estimatedNotional / limits.maxSingleOrderNotional;
  score += Math.min(notionalRatio * 40, 40);

  // Short-selling carries elevated risk
  if (trade.orderType === 'BUY_SHORT') score += 20;

  // Options and futures carry higher risk than equity
  if (trade.assetClass === 'OPTION') score += 15;
  if (trade.assetClass === 'FUTURE') score += 25;

  // Cap at 100
  return Math.min(Math.round(score), 100);
}

/**
 * Evaluate risk check rules and return rejection reasons.
 */
function evaluateRiskRules(trade, limits) {
  const rejectionReasons = [];
  const warnings = [];
  const checksPerformed = [];

  // 1. Asset class allowed check
  checksPerformed.push('ASSET_CLASS_PERMITTED');
  if (!limits.allowedAssetClasses.includes(trade.assetClass)) {
    rejectionReasons.push('ASSET_CLASS_NOT_PERMITTED');
  }

  // 2. Single-order notional limit
  checksPerformed.push('SINGLE_ORDER_NOTIONAL');
  if (trade.estimatedNotional > limits.maxSingleOrderNotional) {
    rejectionReasons.push('SINGLE_ORDER_NOTIONAL_EXCEEDED');
  } else if (trade.estimatedNotional > limits.maxSingleOrderNotional * 0.85) {
    warnings.push('APPROACHING_SINGLE_ORDER_NOTIONAL_LIMIT');
  }

  // 3. Daily loss limit check (simulated)
  checksPerformed.push('DAILY_LOSS_LIMIT');
  const currentDailyPnL = accountDailyPnL.get(trade.accountId) || 0;
  if (currentDailyPnL <= -Math.abs(limits.dailyLossLimit)) {
    rejectionReasons.push('DAILY_LOSS_LIMIT_EXCEEDED');
  } else if (currentDailyPnL <= -Math.abs(limits.dailyLossLimit) * 0.80) {
    warnings.push('APPROACHING_DAILY_LOSS_LIMIT');
  }

  // 4. Concentration check (simplified — flags high notional orders as potential concentration)
  checksPerformed.push('CONCENTRATION_LIMIT');
  const concentrationProxy = trade.estimatedNotional / limits.maxSingleOrderNotional;
  if (concentrationProxy > limits.maxPositionSizePct * 4) {
    rejectionReasons.push('CONCENTRATION_BREACH');
  }

  // 5. Short-sell check — must have explicit permission
  checksPerformed.push('SHORT_SELL_PERMITTED');
  if (trade.orderType === 'BUY_SHORT' && !limits.allowedAssetClasses.includes('EQUITY')) {
    rejectionReasons.push('SHORT_SELLING_NOT_PERMITTED');
  }

  return { rejectionReasons, warnings, checksPerformed };
}

/**
 * Perform a pre-trade risk check for a proposed order.
 * Emits risk.circuit_breaker_triggered (simulated) when a trade is blocked.
 *
 * @param {object} trade
 * @param {string} trade.accountId
 * @param {string} trade.symbol
 * @param {string} trade.orderType
 * @param {string} trade.assetClass
 * @param {number} trade.quantity
 * @param {number} [trade.limitPrice]
 * @param {number} trade.estimatedNotional
 * @returns {Promise<object>}
 */
async function performRiskCheck(trade) {
  const limits = getEffectiveLimits(trade.accountId);
  const { rejectionReasons, warnings, checksPerformed } = evaluateRiskRules(trade, limits);
  const approved = rejectionReasons.length === 0;
  const riskScore = computeRiskScore(trade, limits);

  const checkId = uuidv4();
  const timestamp = new Date().toISOString();

  const record = {
    checkId,
    accountId: trade.accountId,
    symbol: trade.symbol,
    orderType: trade.orderType,
    assetClass: trade.assetClass,
    quantity: trade.quantity,
    limitPrice: trade.limitPrice || null,
    estimatedNotional: trade.estimatedNotional,
    approved,
    riskScore,
    checksPerformed,
    warnings,
    rejectionReasons: approved ? [] : rejectionReasons,
    timestamp,
  };

  riskCheckStore.set(checkId, record);

  if (!approved) {
    // Simulate emitting risk.circuit_breaker_triggered event
    console.info('[event] risk.circuit_breaker_triggered', {
      eventId: uuidv4(),
      accountId: trade.accountId,
      checkId,
      symbol: trade.symbol,
      orderType: trade.orderType,
      quantity: trade.quantity,
      rejectionReasons,
      triggeredAt: timestamp,
    });
  }

  return record;
}

/**
 * Retrieve a previously recorded risk check result by its ID.
 *
 * @param {string} checkId
 * @returns {Promise<object>}
 */
async function getRiskCheck(checkId) {
  const record = riskCheckStore.get(checkId);
  if (!record) {
    const err = new Error(`Risk check ${checkId} not found`);
    err.status = 404;
    throw err;
  }
  return record;
}

/**
 * List all risk check records (optionally filtered by accountId).
 *
 * @param {{ accountId?: string }} filters
 * @returns {Promise<object[]>}
 */
async function listRiskChecks({ accountId } = {}) {
  const all = Array.from(riskCheckStore.values());
  if (accountId) {
    return all.filter((r) => r.accountId === accountId);
  }
  return all;
}

/**
 * Expose account risk limits store for cross-service use within this process.
 * Used by accounts service to persist configured limits.
 */
function setAccountLimits(accountId, limits) {
  accountRiskLimits.set(accountId, limits);
}

function getAccountLimits(accountId) {
  return accountRiskLimits.get(accountId) || null;
}

module.exports = {
  performRiskCheck,
  getRiskCheck,
  listRiskChecks,
  setAccountLimits,
  getAccountLimits,
  DEFAULT_RISK_LIMITS,
};
