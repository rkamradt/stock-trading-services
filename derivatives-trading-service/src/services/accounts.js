'use strict';

const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// In-memory store: derivative positions per account
// ---------------------------------------------------------------------------

/**
 * derivativePositions: map of positionId -> DerivativePosition
 *
 * Each position tracks a derivative holding for a specific account with
 * full Greeks, cost basis, and P&L information.
 */
const derivativePositions = new Map([
  [
    'POS-001',
    {
      positionId: 'POS-001',
      accountId: 'ACC-10001',
      derivativeId: 'DERIV-OPT-AAPL-20240119-150-CALL',
      instrumentType: 'OPTION',
      symbol: 'AAPL240119C00150000',
      underlyingSymbol: 'AAPL',
      optionType: 'CALL',
      strikePrice: 150.0,
      expirationDate: '2024-01-19',
      side: 'LONG',
      quantity: 5,
      multiplier: 100,
      openPrice: 4.8,
      currentPrice: 5.3,
      costBasis: 2400.0, // 5 contracts * 100 multiplier * $4.80
      marketValue: 2650.0, // 5 contracts * 100 multiplier * $5.30
      unrealizedPnl: 250.0,
      unrealizedPnlPercent: 10.42,
      delta: 0.52,
      gamma: 0.04,
      theta: -0.07,
      vega: 0.18,
      rho: 0.03,
      impliedVolatility: 0.28,
      positionDelta: 260.0, // delta * quantity * multiplier
      openedAt: '2024-01-05T14:32:00.000Z',
      updatedAt: new Date().toISOString(),
      status: 'OPEN',
    },
  ],
  [
    'POS-002',
    {
      positionId: 'POS-002',
      accountId: 'ACC-10001',
      derivativeId: 'DERIV-FUT-ES-20240315',
      instrumentType: 'FUTURE',
      symbol: 'ESH24',
      underlyingSymbol: 'SPX',
      optionType: null,
      strikePrice: null,
      expirationDate: '2024-03-15',
      side: 'LONG',
      quantity: 2,
      multiplier: 50,
      openPrice: 4490.0,
      currentPrice: 4520.1,
      costBasis: 449000.0, // 2 contracts * 50 multiplier * $4490
      marketValue: 452010.0,
      unrealizedPnl: 3010.0,
      unrealizedPnlPercent: 0.67,
      delta: 1.0,
      gamma: 0.0,
      theta: 0.0,
      vega: 0.0,
      rho: 0.0,
      impliedVolatility: null,
      positionDelta: 100.0, // 2 contracts * 50 multiplier
      openedAt: '2024-01-03T10:00:00.000Z',
      updatedAt: new Date().toISOString(),
      status: 'OPEN',
    },
  ],
  [
    'POS-003',
    {
      positionId: 'POS-003',
      accountId: 'ACC-10002',
      derivativeId: 'DERIV-OPT-TSLA-20240216-200-CALL',
      instrumentType: 'OPTION',
      symbol: 'TSLA240216C00200000',
      underlyingSymbol: 'TSLA',
      optionType: 'CALL',
      strikePrice: 200.0,
      expirationDate: '2024-02-16',
      side: 'SHORT',
      quantity: 3,
      multiplier: 100,
      openPrice: 16.0,
      currentPrice: 14.6,
      costBasis: -4800.0, // short: received premium 3 * 100 * $16
      marketValue: -4380.0, // short: current liability 3 * 100 * $14.60
      unrealizedPnl: 420.0, // premium received - current liability
      unrealizedPnlPercent: 8.75,
      delta: -0.48, // negative delta for short call
      gamma: -0.02,
      theta: 0.15, // positive theta for short
      vega: -0.42,
      rho: -0.05,
      impliedVolatility: 0.65,
      positionDelta: -144.0, // -0.48 * 3 * 100
      openedAt: '2024-01-10T09:15:00.000Z',
      updatedAt: new Date().toISOString(),
      status: 'OPEN',
    },
  ],
]);

// ---------------------------------------------------------------------------
// Portfolio-level aggregation helpers
// ---------------------------------------------------------------------------

function aggregatePortfolioGreeks(positions) {
  return positions.reduce(
    (agg, pos) => {
      agg.netDelta += pos.positionDelta ?? 0;
      agg.netGamma += (pos.gamma ?? 0) * pos.quantity * (pos.multiplier ?? 1);
      agg.netTheta += (pos.theta ?? 0) * pos.quantity * (pos.multiplier ?? 1);
      agg.netVega += (pos.vega ?? 0) * pos.quantity * (pos.multiplier ?? 1);
      agg.totalUnrealizedPnl += pos.unrealizedPnl ?? 0;
      agg.totalMarketValue += pos.marketValue ?? 0;
      return agg;
    },
    {
      netDelta: 0,
      netGamma: 0,
      netTheta: 0,
      netVega: 0,
      totalUnrealizedPnl: 0,
      totalMarketValue: 0,
    }
  );
}

// ---------------------------------------------------------------------------
// Exported service functions
// ---------------------------------------------------------------------------

/**
 * Get all derivative positions for an account.
 * @param {string} accountId
 * @returns {object} Account derivative positions with portfolio-level Greeks
 */
async function getDerivativePositions(accountId) {
  const positions = Array.from(derivativePositions.values()).filter(
    (pos) => pos.accountId === accountId && pos.status === 'OPEN'
  );

  const portfolioGreeks = aggregatePortfolioGreeks(positions);

  return {
    accountId,
    retrievedAt: new Date().toISOString(),
    positionCount: positions.length,
    portfolioGreeks: {
      netDelta: parseFloat(portfolioGreeks.netDelta.toFixed(4)),
      netGamma: parseFloat(portfolioGreeks.netGamma.toFixed(4)),
      netTheta: parseFloat(portfolioGreeks.netTheta.toFixed(4)),
      netVega: parseFloat(portfolioGreeks.netVega.toFixed(4)),
      totalUnrealizedPnl: parseFloat(portfolioGreeks.totalUnrealizedPnl.toFixed(2)),
      totalMarketValue: parseFloat(portfolioGreeks.totalMarketValue.toFixed(2)),
    },
    positions,
  };
}

/**
 * Open a new derivative position for an account.
 * @param {object} params
 */
async function openPosition({
  accountId,
  derivativeId,
  instrumentType,
  symbol,
  underlyingSymbol,
  optionType,
  strikePrice,
  expirationDate,
  side,
  quantity,
  multiplier,
  openPrice,
  delta,
  gamma,
  theta,
  vega,
  rho,
  impliedVolatility,
}) {
  const positionId = `POS-${uuidv4()}`;
  const now = new Date().toISOString();
  const costBasis =
    side === 'LONG'
      ? quantity * multiplier * openPrice
      : -(quantity * multiplier * openPrice);

  const position = {
    positionId,
    accountId,
    derivativeId,
    instrumentType,
    symbol,
    underlyingSymbol,
    optionType: optionType ?? null,
    strikePrice: strikePrice ?? null,
    expirationDate,
    side,
    quantity,
    multiplier,
    openPrice,
    currentPrice: openPrice,
    costBasis,
    marketValue: costBasis,
    unrealizedPnl: 0.0,
    unrealizedPnlPercent: 0.0,
    delta: delta ?? 0,
    gamma: gamma ?? 0,
    theta: theta ?? 0,
    vega: vega ?? 0,
    rho: rho ?? 0,
    impliedVolatility: impliedVolatility ?? null,
    positionDelta: (delta ?? 0) * quantity * multiplier * (side === 'SHORT' ? -1 : 1),
    openedAt: now,
    updatedAt: now,
    status: 'OPEN',
  };

  derivativePositions.set(positionId, position);
  emitEvent('derivative.position_opened', {
    positionId,
    accountId,
    derivativeId,
    instrumentType,
    symbol,
    side,
    quantity,
    openPrice,
    openedAt: now,
  });

  return position;
}

/**
 * Update Greeks on an existing position.
 * @param {string} positionId
 * @param {object} greeks
 */
async function updatePositionGreeks(positionId, greeks) {
  const position = derivativePositions.get(positionId);
  if (!position) {
    const err = new Error(`Position not found: ${positionId}`);
    err.status = 404;
    throw err;
  }

  Object.assign(position, greeks, { updatedAt: new Date().toISOString() });
  position.positionDelta =
    (position.delta ?? 0) *
    position.quantity *
    position.multiplier *
    (position.side === 'SHORT' ? -1 : 1);

  derivativePositions.set(positionId, position);
  return position;
}

/**
 * Close a position (mark as CLOSED).
 * @param {string} positionId
 * @param {number} closePrice
 */
async function closePosition(positionId, closePrice) {
  const position = derivativePositions.get(positionId);
  if (!position) {
    const err = new Error(`Position not found: ${positionId}`);
    err.status = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const finalMarketValue =
    position.side === 'LONG'
      ? position.quantity * position.multiplier * closePrice
      : -(position.quantity * position.multiplier * closePrice);

  const realizedPnl = finalMarketValue - position.costBasis;

  Object.assign(position, {
    currentPrice: closePrice,
    marketValue: finalMarketValue,
    unrealizedPnl: 0,
    realizedPnl,
    status: 'CLOSED',
    closedAt: now,
    updatedAt: now,
  });

  derivativePositions.set(positionId, position);
  return position;
}

/**
 * Get a single position by ID.
 */
async function getPosition(positionId) {
  const position = derivativePositions.get(positionId);
  if (!position) {
    const err = new Error(`Position not found: ${positionId}`);
    err.status = 404;
    throw err;
  }
  return position;
}

/**
 * List all positions (all accounts, all statuses).
 */
async function listPositions() {
  return Array.from(derivativePositions.values());
}

// ---------------------------------------------------------------------------
// Internal event emission stub
// ---------------------------------------------------------------------------
function emitEvent(topic, payload) {
  console.log(`[event:${topic}]`, JSON.stringify({ ...payload, _eventId: uuidv4() }));
}

module.exports = {
  getDerivativePositions,
  openPosition,
  updatePositionGreeks,
  closePosition,
  getPosition,
  listPositions,
};
