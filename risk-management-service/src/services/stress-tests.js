'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store of stress test execution results.
 * Keyed by stressTestId.
 *
 * @type {Map<string, object>}
 */
const stressTestStore = new Map();

/**
 * Simulated portfolio baseline market values used for scenario P&L estimation.
 * In production these would be fetched from portfolio-service.
 */
const portfolioBaselines = new Map([
  ['port-001', { totalMarketValue: 500000.0, equityPct: 0.80, fixedIncomePct: 0.15, cashPct: 0.05 }],
  ['port-002', { totalMarketValue: 1250000.0, equityPct: 0.65, fixedIncomePct: 0.20, cashPct: 0.15 }],
  ['port-003', { totalMarketValue: 320000.0, equityPct: 0.90, fixedIncomePct: 0.05, cashPct: 0.05 }],
]);

/**
 * Default risk limits used to evaluate whether a scenario breaches thresholds.
 */
const DEFAULT_MAX_DRAWDOWN_PCT = 0.15;

/**
 * Estimate the P&L impact of a single scenario on the portfolio.
 *
 * The model accounts for:
 *  - Equity shock on the equity allocation
 *  - Interest rate shock on fixed income (duration ≈ 5 for simplified model)
 *  - Volatility shock modelled as a 5% additional equity drag
 *  - Credit spread shock on fixed income notional
 *
 * @param {object} baseline
 * @param {object} scenario
 * @returns {{ estimatedPnL: number, pnlPct: number }}
 */
function estimateScenarioPnL(baseline, scenario) {
  const { totalMarketValue, equityPct, fixedIncomePct } = baseline;

  const equityNotional = totalMarketValue * equityPct;
  const fixedIncomeNotional = totalMarketValue * fixedIncomePct;

  const equityShock = scenario.equityShock || 0;
  const interestRateShock = scenario.interestRateShock || 0;
  const volatilityShock = scenario.volatilityShock || 0;
  const creditSpreadShock = scenario.creditSpreadShock || 0;

  // Equity component
  const equityPnL = equityNotional * equityShock;

  // Volatility-induced additional equity drag (simplified: 5× vol shock as % loss)
  const volatilityDrag = equityNotional * (-Math.abs(volatilityShock) * 0.05);

  // Fixed income: modified duration ≈ 5 years, so ΔP ≈ -duration × Δr × notional
  const fixedIncomePnL = fixedIncomeNotional * (-5 * interestRateShock);

  // Credit spread impact on fixed income
  const creditPnL = fixedIncomeNotional * (-5 * creditSpreadShock);

  const totalPnL = parseFloat((equityPnL + volatilityDrag + fixedIncomePnL + creditPnL).toFixed(2));
  const pnlPct = parseFloat((totalPnL / totalMarketValue).toFixed(6));

  return { estimatedPnL: totalPnL, pnlPct };
}

/**
 * Evaluate whether a scenario result breaches risk limits.
 *
 * @param {{ estimatedPnL: number, pnlPct: number }} scenarioResult
 * @param {object} baseline
 * @returns {{ breachesRiskLimits: boolean, breachedLimits: string[] }}
 */
function evaluateBreaches(scenarioResult, baseline) {
  const { pnlPct } = scenarioResult;
  const breachedLimits = [];

  if (Math.abs(pnlPct) > DEFAULT_MAX_DRAWDOWN_PCT) {
    breachedLimits.push('MAX_DRAWDOWN');
  }

  if (scenarioResult.estimatedPnL < -0.20 * baseline.totalMarketValue) {
    breachedLimits.push('CATASTROPHIC_LOSS_THRESHOLD');
  }

  return {
    breachesRiskLimits: breachedLimits.length > 0,
    breachedLimits,
  };
}

/**
 * Run one or more stress test scenarios against a portfolio.
 *
 * @param {object} params
 * @param {string} params.portfolioId
 * @param {string} params.accountId
 * @param {Array<{ scenarioName: string, equityShock?: number, interestRateShock?: number, volatilityShock?: number, creditSpreadShock?: number }>} params.scenarios
 * @returns {Promise<object>}
 */
async function runStressTests({ portfolioId, accountId, scenarios }) {
  const stressTestId = uuidv4();
  const executedAt = new Date().toISOString();

  const baseline = portfolioBaselines.get(portfolioId) || {
    totalMarketValue: 0.0,
    equityPct: 1.0,
    fixedIncomePct: 0.0,
    cashPct: 0.0,
  };

  const results = scenarios.map((scenario) => {
    const { estimatedPnL, pnlPct } = estimateScenarioPnL(baseline, scenario);
    const { breachesRiskLimits, breachedLimits } = evaluateBreaches(
      { estimatedPnL, pnlPct },
      baseline
    );

    return {
      scenarioName: scenario.scenarioName,
      inputs: {
        equityShock: scenario.equityShock || 0,
        interestRateShock: scenario.interestRateShock || 0,
        volatilityShock: scenario.volatilityShock || 0,
        creditSpreadShock: scenario.creditSpreadShock || 0,
      },
      estimatedPnL,
      pnlPct,
      breachesRiskLimits,
      breachedLimits,
    };
  });

  // Identify the worst-case scenario by the most negative P&L
  const worstCase = results.reduce((worst, r) =>
    r.estimatedPnL < worst.estimatedPnL ? r : worst
  );

  const stressTestRecord = {
    stressTestId,
    portfolioId,
    accountId,
    portfolioTotalMarketValue: baseline.totalMarketValue,
    scenariosRun: results.length,
    results,
    worstCaseScenario: worstCase.scenarioName,
    worstCaseLoss: worstCase.estimatedPnL,
    anyBreaches: results.some((r) => r.breachesRiskLimits),
    executedAt,
  };

  stressTestStore.set(stressTestId, stressTestRecord);

  return stressTestRecord;
}

/**
 * Retrieve a specific stress test result by its ID.
 *
 * @param {string} stressTestId
 * @returns {Promise<object>}
 */
async function getStressTest(stressTestId) {
  const record = stressTestStore.get(stressTestId);
  if (!record) {
    const err = new Error(`Stress test ${stressTestId} not found`);
    err.status = 404;
    throw err;
  }
  return { ...record };
}

/**
 * List all stress test results, optionally filtered by portfolioId or accountId.
 *
 * @param {{ portfolioId?: string, accountId?: string }} filters
 * @returns {Promise<object[]>}
 */
async function listStressTests({ portfolioId, accountId } = {}) {
  let results = Array.from(stressTestStore.values());
  if (portfolioId) results = results.filter((r) => r.portfolioId === portfolioId);
  if (accountId) results = results.filter((r) => r.accountId === accountId);
  return results;
}

/**
 * Add or update a portfolio baseline (for testing or administrative use).
 *
 * @param {string} portfolioId
 * @param {{ totalMarketValue: number, equityPct: number, fixedIncomePct: number, cashPct: number }} baseline
 */
function upsertPortfolioBaseline(portfolioId, baseline) {
  portfolioBaselines.set(portfolioId, baseline);
}

module.exports = {
  runStressTests,
  getStressTest,
  listStressTests,
  upsertPortfolioBaseline,
};
