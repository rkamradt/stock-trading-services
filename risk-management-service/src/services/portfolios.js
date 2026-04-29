'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store of VaR calculation results.
 * Keyed by portfolioId + confidenceLevel + horizon composite key.
 *
 * @type {Map<string, object>}
 */
const varResultsStore = new Map();

/**
 * Simulated portfolio total market values for VaR calculation.
 * In production these would be fetched from portfolio-service.
 */
const portfolioMarketValues = new Map([
  ['port-001', { totalMarketValue: 500000.0, annualVolatility: 0.18 }],
  ['port-002', { totalMarketValue: 1250000.0, annualVolatility: 0.24 }],
  ['port-003', { totalMarketValue: 320000.0, annualVolatility: 0.12 }],
]);

/**
 * Normal distribution quantile (z-score) lookup for common confidence levels.
 * Used in the parametric VaR calculation fallback.
 */
const Z_SCORES = {
  0.90: 1.2816,
  0.95: 1.6449,
  0.99: 2.3263,
  0.995: 2.5758,
};

/**
 * Get the z-score for a given confidence level.
 * Interpolates linearly if the exact level is not in the lookup table.
 */
function getZScore(confidenceLevel) {
  if (Z_SCORES[confidenceLevel] !== undefined) {
    return Z_SCORES[confidenceLevel];
  }
  // Linear approximation for arbitrary confidence levels
  return 1.6449 + (confidenceLevel - 0.95) * ((2.3263 - 1.6449) / (0.99 - 0.95));
}

/**
 * Calculate parametric VaR and CVaR for a portfolio.
 *
 * Formula:
 *   dailyVol = annualVolatility / sqrt(252)
 *   VaR      = portfolioValue * dailyVol * zScore * sqrt(horizonDays)
 *   CVaR     ≈ VaR * (phi(zScore) / (1 - confidenceLevel))   [approximate]
 *
 * @param {string} portfolioId
 * @param {number} confidenceLevel  e.g. 0.95
 * @param {number} horizonDays      holding period in trading days
 * @returns {Promise<object>}
 */
async function calculateVaR(portfolioId, confidenceLevel = 0.95, horizonDays = 1) {
  const portfolioData = portfolioMarketValues.get(portfolioId);

  let totalMarketValue;
  let annualVolatility;

  if (!portfolioData) {
    // Return a zero-risk VaR for unknown portfolios rather than 404,
    // since this is a calculation endpoint and the portfolio may be empty/new.
    totalMarketValue = 0.0;
    annualVolatility = 0.0;
  } else {
    totalMarketValue = portfolioData.totalMarketValue;
    annualVolatility = portfolioData.annualVolatility;
  }

  const dailyVolatility = annualVolatility / Math.sqrt(252);
  const zScore = getZScore(confidenceLevel);
  const horizonScalar = Math.sqrt(horizonDays);

  const varAmount = parseFloat(
    (totalMarketValue * dailyVolatility * zScore * horizonScalar).toFixed(2)
  );
  const varPct = totalMarketValue > 0
    ? parseFloat((varAmount / totalMarketValue).toFixed(6))
    : 0.0;

  // CVaR (Expected Shortfall) approximation: CVaR ≈ VaR * 1.35 for normal distributions
  const cVaR = parseFloat((varAmount * 1.35).toFixed(2));

  const calculatedAt = new Date().toISOString();

  const result = {
    portfolioId,
    confidenceLevel,
    horizonDays,
    varAmount,
    varPct,
    cVaR,
    totalMarketValue,
    annualVolatility,
    methodology: 'PARAMETRIC_NORMAL',
    lookbackDays: 252,
    calculatedAt,
  };

  // Cache the most recent result
  const cacheKey = `${portfolioId}:${confidenceLevel}:${horizonDays}`;
  varResultsStore.set(cacheKey, result);

  return result;
}

/**
 * Retrieve the most recently cached VaR result for a portfolio.
 *
 * @param {string} portfolioId
 * @param {number} confidenceLevel
 * @param {number} horizonDays
 * @returns {Promise<object|null>}
 */
async function getCachedVaR(portfolioId, confidenceLevel = 0.95, horizonDays = 1) {
  const cacheKey = `${portfolioId}:${confidenceLevel}:${horizonDays}`;
  return varResultsStore.get(cacheKey) || null;
}

/**
 * Update simulated portfolio market data (used by tests and internal calls).
 *
 * @param {string} portfolioId
 * @param {{ totalMarketValue: number, annualVolatility: number }} data
 */
function upsertPortfolioData(portfolioId, data) {
  portfolioMarketValues.set(portfolioId, data);
}

/**
 * List all known portfolio IDs with their market data.
 *
 * @returns {Promise<object[]>}
 */
async function listPortfolios() {
  return Array.from(portfolioMarketValues.entries()).map(([portfolioId, data]) => ({
    portfolioId,
    ...data,
  }));
}

module.exports = {
  calculateVaR,
  getCachedVaR,
  upsertPortfolioData,
  listPortfolios,
};
