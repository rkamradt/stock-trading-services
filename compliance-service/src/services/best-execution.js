'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store for best execution analyses.
 * @type {Map<string, Object>}
 */
const bestExecutionAnalyses = new Map();

// Seed with example data
(function seedAnalyses() {
  const seed = [
    {
      analysisId: 'bea-001',
      orderId: 'ord-500',
      tradeId: 'trd-500',
      accountId: 'acct-001',
      symbol: 'AAPL',
      orderType: 'MARKET',
      executedPrice: 185.42,
      executedQuantity: 100,
      marketPriceAtExecution: 185.40,
      executionVenue: 'NYSE',
      executionTimestamp: '2024-01-20T14:22:10.000Z',
      bestExecutionScore: 98.5,
      priceImprovement: 0.02,
      priceImprovementBps: 0.11,
      complianceStatus: 'COMPLIANT',
      findings: ['Execution at market price with minor price improvement', 'Venue selection appropriate for security type'],
      venueComparison: [
        { venue: 'NYSE', price: 185.40, latencyMs: 15 },
        { venue: 'NASDAQ', price: 185.43, latencyMs: 12 },
        { venue: 'BATS', price: 185.41, latencyMs: 8 },
      ],
      analyzedAt: '2024-01-20T14:22:11.000Z',
    },
    {
      analysisId: 'bea-002',
      orderId: 'ord-501',
      tradeId: 'trd-501',
      accountId: 'acct-002',
      symbol: 'MSFT',
      orderType: 'LIMIT',
      executedPrice: 375.10,
      executedQuantity: 200,
      marketPriceAtExecution: 374.95,
      executionVenue: 'NASDAQ',
      executionTimestamp: '2024-01-21T10:05:30.000Z',
      bestExecutionScore: 94.2,
      priceImprovement: 0.15,
      priceImprovementBps: 0.40,
      complianceStatus: 'COMPLIANT',
      findings: ['Limit order filled above market price, demonstrating best execution', 'Trade routing optimized for fill quality'],
      venueComparison: [
        { venue: 'NASDAQ', price: 375.10, latencyMs: 10 },
        { venue: 'NYSE', price: 375.08, latencyMs: 18 },
      ],
      analyzedAt: '2024-01-21T10:05:31.000Z',
    },
  ];
  seed.forEach((a) => bestExecutionAnalyses.set(a.analysisId, a));
})();

/**
 * Analyze an executed trade for best execution compliance.
 *
 * @param {Object} params
 * @param {string} params.accountId
 * @param {string} [params.orderId]
 * @param {string} [params.tradeId]
 * @param {string} params.symbol
 * @param {string} params.orderType
 * @param {number} params.executedPrice
 * @param {number} params.executedQuantity
 * @param {number} params.marketPriceAtExecution
 * @param {string} params.executionVenue
 * @param {string} params.executionTimestamp
 * @returns {Promise<Object>}
 */
async function analyzeBestExecution(params) {
  const {
    accountId,
    orderId,
    tradeId,
    symbol,
    orderType,
    executedPrice,
    executedQuantity,
    marketPriceAtExecution,
    executionVenue,
    executionTimestamp,
  } = params;

  const analysisId = `bea-${uuidv4()}`;
  const now = new Date().toISOString();

  // Determine price improvement (positive = better than market for buy, treat all as buy-side for simplicity)
  const priceImprovement = parseFloat((marketPriceAtExecution - executedPrice).toFixed(4));
  const priceImprovementBps = marketPriceAtExecution > 0
    ? parseFloat(((priceImprovement / marketPriceAtExecution) * 10000).toFixed(4))
    : 0;

  // Score: base 100, deduct for negative price improvement
  let bestExecutionScore = 100;
  const findings = [];

  if (priceImprovement > 0) {
    bestExecutionScore = Math.min(100, bestExecutionScore + priceImprovementBps * 0.5);
    findings.push(`Price improvement of $${priceImprovement.toFixed(4)} (${priceImprovementBps.toFixed(2)} bps) achieved`);
  } else if (priceImprovement < 0) {
    bestExecutionScore = Math.max(0, bestExecutionScore + priceImprovementBps * 2); // penalize negative improvement more
    findings.push(`Execution at $${Math.abs(priceImprovement).toFixed(4)} worse than market price — requires review`);
  } else {
    findings.push('Execution at market price — no price improvement or degradation');
  }

  const venueQualityMap = {
    NYSE: { latencyMs: 15, fillQuality: 'HIGH' },
    NASDAQ: { latencyMs: 10, fillQuality: 'HIGH' },
    BATS: { latencyMs: 8, fillQuality: 'MEDIUM' },
    IEX: { latencyMs: 35, fillQuality: 'HIGH' },
    EDGX: { latencyMs: 9, fillQuality: 'MEDIUM' },
  };

  const venueInfo = venueQualityMap[executionVenue] || { latencyMs: 20, fillQuality: 'MEDIUM' };
  findings.push(`Execution venue ${executionVenue}: latency ~${venueInfo.latencyMs}ms, fill quality ${venueInfo.fillQuality}`);

  if (orderType === 'MARKET' && bestExecutionScore < 80) {
    findings.push('Market order executed at unfavorable price — consider using limit orders for large size');
  }

  const complianceStatus = bestExecutionScore >= 75 ? 'COMPLIANT' : 'NON_COMPLIANT';

  if (complianceStatus === 'NON_COMPLIANT') {
    findings.push('Best execution standards not met — compliance review required');
    emitEvent('compliance.audit_required', {
      auditId: `aud-${uuidv4()}`,
      subjectEntityId: orderId || tradeId || accountId,
      subjectEntityType: orderId ? 'ORDER' : tradeId ? 'TRADE' : 'ACCOUNT',
      reason: `Best execution score ${bestExecutionScore.toFixed(1)} below required threshold of 75`,
      priority: 'HIGH',
      requestedAt: now,
      requestedBy: 'best-execution-analyzer',
    });
  }

  const analysis = {
    analysisId,
    orderId: orderId || null,
    tradeId: tradeId || null,
    accountId,
    symbol,
    orderType,
    executedPrice,
    executedQuantity,
    marketPriceAtExecution,
    executionVenue,
    executionTimestamp,
    bestExecutionScore: parseFloat(bestExecutionScore.toFixed(2)),
    priceImprovement,
    priceImprovementBps,
    complianceStatus,
    findings,
    venueComparison: [
      { venue: executionVenue, price: executedPrice, latencyMs: venueInfo.latencyMs },
    ],
    analyzedAt: now,
  };

  bestExecutionAnalyses.set(analysisId, analysis);
  return analysis;
}

/**
 * Get a best execution analysis by ID.
 *
 * @param {string} analysisId
 * @returns {Promise<Object>}
 */
async function getBestExecutionAnalysis(analysisId) {
  const analysis = bestExecutionAnalyses.get(analysisId);
  if (!analysis) {
    const err = new Error(`Best execution analysis '${analysisId}' not found`);
    err.status = 404;
    throw err;
  }
  return analysis;
}

/**
 * List best execution analyses with optional filtering.
 *
 * @param {Object} [filters]
 * @param {string} [filters.accountId]
 * @param {string} [filters.complianceStatus]
 * @param {number} [filters.limit]
 * @param {number} [filters.offset]
 * @returns {Promise<Object[]>}
 */
async function listBestExecutionAnalyses(filters = {}) {
  const { accountId, complianceStatus, limit = 50, offset = 0 } = filters;
  let analyses = Array.from(bestExecutionAnalyses.values());

  if (accountId) analyses = analyses.filter((a) => a.accountId === accountId);
  if (complianceStatus) analyses = analyses.filter((a) => a.complianceStatus === complianceStatus);

  const total = analyses.length;
  return {
    total,
    limit,
    offset,
    analyses: analyses.sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt)).slice(offset, offset + limit),
  };
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
  analyzeBestExecution,
  getBestExecutionAnalysis,
  listBestExecutionAnalyses,
};
