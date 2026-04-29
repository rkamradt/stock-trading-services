'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory cache for computed performance and position summary snapshots.
 */
const performanceCache = new Map();
const positionSummaryCache = new Map();

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/**
 * Publish a domain event (fire-and-forget; logs on failure).
 */
async function publishEvent(topic, payload) {
  const eventBusUrl = process.env.EVENT_BUS_URL;
  if (!eventBusUrl) return;
  try {
    const http = require('http');
    const https = require('https');
    const body = JSON.stringify({ topic, payload, occurredAt: new Date().toISOString() });
    const url = new URL(`${eventBusUrl}/events`);
    const transport = url.protocol === 'https:' ? https : http;
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    };
    await new Promise((resolve) => {
      const req = transport.request(options, (res) => { res.resume(); res.on('end', resolve); });
      req.on('error', () => resolve());
      req.write(body);
      req.end();
    });
  } catch (_) {
    // Non-fatal
  }
}

/**
 * Simulate fetching positions from PortfolioService.
 * In production this would be an HTTP call to portfolio-service.
 */
function simulatePositions(accountId, count = null) {
  const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM', 'V', 'JNJ'];
  const positionCount = count !== null ? count : Math.floor(Math.random() * 8) + 2;
  const selectedSymbols = symbols.slice(0, positionCount);

  return selectedSymbols.map((symbol) => {
    const quantity = Math.floor(Math.random() * 500) + 10;
    const averageCostBasis = parseFloat((Math.random() * 300 + 50).toFixed(2));
    const currentPrice = parseFloat((averageCostBasis * (0.7 + Math.random() * 0.7)).toFixed(2));
    const marketValue = parseFloat((quantity * currentPrice).toFixed(2));
    const totalCostBasis = parseFloat((quantity * averageCostBasis).toFixed(2));
    const unrealizedPnl = parseFloat((marketValue - totalCostBasis).toFixed(2));
    const unrealizedPnlPercent = parseFloat(((unrealizedPnl / totalCostBasis) * 100).toFixed(2));
    const realizedPnl = parseFloat(((Math.random() - 0.4) * 5000).toFixed(2));
    const dayChange = parseFloat(((Math.random() - 0.5) * currentPrice * 0.03).toFixed(2));
    const dayChangePercent = parseFloat(((dayChange / currentPrice) * 100).toFixed(2));
    const weight = 0; // will be computed after total is known

    return {
      symbol,
      quantity,
      averageCostBasis,
      currentPrice,
      marketValue,
      totalCostBasis,
      unrealizedPnl,
      unrealizedPnlPercent,
      realizedPnl,
      dayChange,
      dayChangePercent,
      sector: getSector(symbol),
      assetClass: 'EQUITY',
      currency: 'USD',
      weight,
    };
  });
}

/**
 * Return a mock sector for well-known symbols.
 */
function getSector(symbol) {
  const sectorMap = {
    AAPL: 'Technology',
    MSFT: 'Technology',
    GOOGL: 'Communication Services',
    AMZN: 'Consumer Discretionary',
    TSLA: 'Consumer Discretionary',
    NVDA: 'Technology',
    META: 'Communication Services',
    JPM: 'Financials',
    V: 'Financials',
    JNJ: 'Health Care',
  };
  return sectorMap[symbol] || 'Unknown';
}

/**
 * Simulate a derivative position record.
 */
function simulateDerivativePositions(accountId) {
  return [
    {
      derivativeId: uuidv4(),
      symbol: 'AAPL',
      instrumentType: 'CALL_OPTION',
      strikePrice: 180.0,
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quantity: 5,
      currentPrice: parseFloat((Math.random() * 10 + 1).toFixed(2)),
      marketValue: parseFloat((5 * 100 * (Math.random() * 10 + 1)).toFixed(2)),
      delta: parseFloat((Math.random() * 0.8 + 0.1).toFixed(4)),
      gamma: parseFloat((Math.random() * 0.05).toFixed(6)),
      theta: parseFloat((-Math.random() * 0.1).toFixed(6)),
      vega: parseFloat((Math.random() * 0.5).toFixed(6)),
      currency: 'USD',
    },
  ];
}

// ---------------------------------------------------------------------------
// Performance analytics
// ---------------------------------------------------------------------------

/**
 * Generate portfolio performance analytics and benchmarking for an account.
 *
 * @param {{ accountId: string, period?: string, benchmark?: string }} params
 * @returns {Promise<object>}
 */
async function getPerformance({ accountId, period = '1Y', benchmark = 'SPX' }) {
  const cacheKey = `${accountId}:${period}:${benchmark}`;
  if (performanceCache.has(cacheKey)) {
    return performanceCache.get(cacheKey);
  }

  const positions = simulatePositions(accountId);
  const totalMarketValue = parseFloat(positions.reduce((s, p) => s + p.marketValue, 0).toFixed(2));

  // Compute weights
  positions.forEach((p) => {
    p.weight = parseFloat(((p.marketValue / totalMarketValue) * 100).toFixed(2));
  });

  const benchmarkReturn = parseFloat(((Math.random() - 0.3) * 25).toFixed(2));
  const totalReturn = parseFloat(((Math.random() - 0.3) * 30).toFixed(2));

  const periodDays = {
    '1M': 21,
    '3M': 63,
    '6M': 126,
    YTD: Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (24 * 60 * 60 * 1000)),
    '1Y': 252,
    '3Y': 756,
    '5Y': 1260,
    ALL: 1260,
  }[period] || 252;

  const annualizedReturn = parseFloat((((1 + totalReturn / 100) ** (252 / periodDays) - 1) * 100).toFixed(2));
  const alpha = parseFloat((totalReturn - benchmarkReturn).toFixed(2));
  const beta = parseFloat((0.7 + Math.random() * 0.6).toFixed(4));
  const sharpeRatio = parseFloat(((annualizedReturn - 5.25) / (Math.random() * 10 + 8)).toFixed(4));
  const sortinoRatio = parseFloat((sharpeRatio * (1 + Math.random() * 0.3)).toFixed(4));
  const maxDrawdown = parseFloat((-Math.random() * 20).toFixed(2));
  const informationRatio = parseFloat(((alpha / (Math.random() * 8 + 2))).toFixed(4));

  const sectorAllocation = {};
  positions.forEach((p) => {
    sectorAllocation[p.sector] = parseFloat(
      ((sectorAllocation[p.sector] || 0) + p.weight).toFixed(2)
    );
  });

  const result = {
    accountId,
    performancePeriod: period,
    benchmark,
    asOf: new Date().toISOString(),
    totalMarketValue,
    totalReturn,
    annualizedReturn,
    benchmarkReturn,
    alpha,
    beta,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    informationRatio,
    currency: 'USD',
    sectorAllocation,
    topPerformers: positions
      .sort((a, b) => b.unrealizedPnlPercent - a.unrealizedPnlPercent)
      .slice(0, 3)
      .map((p) => ({ symbol: p.symbol, unrealizedPnlPercent: p.unrealizedPnlPercent })),
    underPerformers: positions
      .sort((a, b) => a.unrealizedPnlPercent - b.unrealizedPnlPercent)
      .slice(0, 3)
      .map((p) => ({ symbol: p.symbol, unrealizedPnlPercent: p.unrealizedPnlPercent })),
    positions,
  };

  performanceCache.set(cacheKey, result);

  await publishEvent('report.generated', {
    reportId: uuidv4(),
    reportType: 'PERFORMANCE',
    accountId,
    generatedAt: new Date().toISOString(),
    format: 'JSON',
    sizeBytes: JSON.stringify(result).length,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Position summary
// ---------------------------------------------------------------------------

/**
 * Generate a position and holdings summary report for an account.
 *
 * @param {{ accountId: string, asOf?: string, includeDerivatives?: boolean }} params
 * @returns {Promise<object>}
 */
async function getPositionSummary({ accountId, asOf, includeDerivatives = false }) {
  const asOfDate = asOf ? new Date(asOf).toISOString() : new Date().toISOString();
  const cacheKey = `${accountId}:${asOfDate}:${includeDerivatives}`;

  if (positionSummaryCache.has(cacheKey)) {
    return positionSummaryCache.get(cacheKey);
  }

  const positions = simulatePositions(accountId);
  const totalMarketValue = parseFloat(positions.reduce((s, p) => s + p.marketValue, 0).toFixed(2));
  const totalCostBasis = parseFloat(positions.reduce((s, p) => s + p.totalCostBasis, 0).toFixed(2));
  const totalUnrealizedPnl = parseFloat(positions.reduce((s, p) => s + p.unrealizedPnl, 0).toFixed(2));
  const totalRealizedPnl = parseFloat(positions.reduce((s, p) => s + p.realizedPnl, 0).toFixed(2));
  const cashBalance = parseFloat((Math.random() * 20000 + 1000).toFixed(2));

  // Compute weights
  positions.forEach((p) => {
    p.weight = parseFloat(((p.marketValue / totalMarketValue) * 100).toFixed(2));
  });

  const sectorBreakdown = {};
  positions.forEach((p) => {
    if (!sectorBreakdown[p.sector]) {
      sectorBreakdown[p.sector] = { marketValue: 0, weight: 0, positionCount: 0 };
    }
    sectorBreakdown[p.sector].marketValue = parseFloat(
      (sectorBreakdown[p.sector].marketValue + p.marketValue).toFixed(2)
    );
    sectorBreakdown[p.sector].weight = parseFloat(
      ((sectorBreakdown[p.sector].marketValue / totalMarketValue) * 100).toFixed(2)
    );
    sectorBreakdown[p.sector].positionCount += 1;
  });

  let derivativePositions = [];
  let derivativeMarketValue = 0;
  if (includeDerivatives) {
    derivativePositions = simulateDerivativePositions(accountId);
    derivativeMarketValue = parseFloat(
      derivativePositions.reduce((s, d) => s + d.marketValue, 0).toFixed(2)
    );
  }

  const totalAccountValue = parseFloat(
    (totalMarketValue + cashBalance + derivativeMarketValue).toFixed(2)
  );

  const result = {
    accountId,
    asOf: asOfDate,
    totalAccountValue,
    totalMarketValue,
    totalCostBasis,
    totalUnrealizedPnl,
    totalUnrealizedPnlPercent: parseFloat(((totalUnrealizedPnl / totalCostBasis) * 100).toFixed(2)),
    totalRealizedPnl,
    cashBalance,
    currency: 'USD',
    positionCount: positions.length,
    sectorBreakdown,
    positions,
    ...(includeDerivatives && {
      derivativePositions,
      derivativeMarketValue,
    }),
  };

  positionSummaryCache.set(cacheKey, result);

  await publishEvent('report.generated', {
    reportId: uuidv4(),
    reportType: 'POSITION_SUMMARY',
    accountId,
    generatedAt: new Date().toISOString(),
    format: 'JSON',
    sizeBytes: JSON.stringify(result).length,
  });

  return result;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  getPerformance,
  getPositionSummary,
  // Expose caches for testing
  _performanceCache: performanceCache,
  _positionSummaryCache: positionSummaryCache,
};
