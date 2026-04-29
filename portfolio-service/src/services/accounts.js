'use strict';

const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

/**
 * positions[accountId][symbol] = Position
 * @type {Map<string, Map<string, object>>}
 */
const positionsStore = new Map();

/**
 * lots[accountId][symbol] = Lot[]   (FIFO order — oldest first)
 * @type {Map<string, Map<string, object[]>>}
 */
const lotsStore = new Map();

/**
 * transactions[accountId][symbol] = PositionTransaction[]
 * @type {Map<string, Map<string, object[]>>}
 */
const transactionsStore = new Map();

/**
 * realizedPnlStore[accountId] = number  (cumulative realized P&L)
 * @type {Map<string, number>}
 */
const realizedPnlStore = new Map();

// ---------------------------------------------------------------------------
// Seed data — gives reviewers realistic data to work with immediately
// ---------------------------------------------------------------------------
(function seed() {
  const accountId = 'ACC-001';
  const now = new Date();

  const mkDate = (daysAgo) => {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString();
  };

  // Positions
  const positions = new Map();
  positions.set('AAPL', {
    positionId: uuidv4(),
    accountId,
    symbol: 'AAPL',
    quantity: 100,
    averageCostBasis: 172.45,
    totalCostBasis: 17245.0,
    currentPrice: 178.9,
    marketValue: 17890.0,
    unrealizedPnl: 645.0,
    unrealizedPnlPercent: 3.74,
    openedAt: mkDate(45),
    updatedAt: mkDate(2),
    status: 'open',
  });
  positions.set('MSFT', {
    positionId: uuidv4(),
    accountId,
    symbol: 'MSFT',
    quantity: 50,
    averageCostBasis: 415.2,
    totalCostBasis: 20760.0,
    currentPrice: 430.5,
    marketValue: 21525.0,
    unrealizedPnl: 765.0,
    unrealizedPnlPercent: 3.69,
    openedAt: mkDate(30),
    updatedAt: mkDate(1),
    status: 'open',
  });
  positionsStore.set(accountId, positions);

  // Lots for AAPL
  const appleLots = [
    {
      lotId: uuidv4(),
      acquiredAt: mkDate(45),
      quantity: 60,
      costBasis: 168.0,
      remainingQuantity: 60,
    },
    {
      lotId: uuidv4(),
      acquiredAt: mkDate(20),
      quantity: 40,
      costBasis: 179.25,
      remainingQuantity: 40,
    },
  ];
  const msftLots = [
    {
      lotId: uuidv4(),
      acquiredAt: mkDate(30),
      quantity: 50,
      costBasis: 415.2,
      remainingQuantity: 50,
    },
  ];
  const lots = new Map();
  lots.set('AAPL', appleLots);
  lots.set('MSFT', msftLots);
  lotsStore.set(accountId, lots);

  // Transactions
  const transactions = new Map();
  transactions.set('AAPL', [
    {
      transactionId: uuidv4(),
      type: 'buy',
      quantity: 60,
      price: 168.0,
      fees: 0.5,
      realizedPnl: null,
      executedAt: mkDate(45),
      notes: 'Initial AAPL purchase',
    },
    {
      transactionId: uuidv4(),
      type: 'buy',
      quantity: 40,
      price: 179.25,
      fees: 0.5,
      realizedPnl: null,
      executedAt: mkDate(20),
      notes: 'Additional AAPL purchase',
    },
  ]);
  transactions.set('MSFT', [
    {
      transactionId: uuidv4(),
      type: 'buy',
      quantity: 50,
      price: 415.2,
      fees: 0.5,
      realizedPnl: null,
      executedAt: mkDate(30),
      notes: 'Initial MSFT purchase',
    },
  ]);
  transactionsStore.set(accountId, transactions);

  realizedPnlStore.set(accountId, 0);
})();

// ---------------------------------------------------------------------------
// Helper: ensure sub-stores exist for an account
// ---------------------------------------------------------------------------
function ensureAccount(accountId) {
  if (!positionsStore.has(accountId)) positionsStore.set(accountId, new Map());
  if (!lotsStore.has(accountId)) lotsStore.set(accountId, new Map());
  if (!transactionsStore.has(accountId))
    transactionsStore.set(accountId, new Map());
  if (!realizedPnlStore.has(accountId)) realizedPnlStore.set(accountId, 0);
}

// ---------------------------------------------------------------------------
// Helper: stub market price lookup
//   In production this calls market-data-provider.  Here we return a
//   deterministic mock so the service works standalone.
// ---------------------------------------------------------------------------
async function fetchCurrentPrice(symbol) {
  const mockPrices = {
    AAPL: 178.9,
    MSFT: 430.5,
    GOOGL: 175.4,
    AMZN: 195.2,
    TSLA: 248.5,
    NVDA: 875.3,
    META: 505.7,
    JPM: 198.4,
    BAC: 38.2,
    GS: 470.1,
  };
  return mockPrices[symbol] ?? 100.0;
}

// ---------------------------------------------------------------------------
// Helper: event publisher stub
// ---------------------------------------------------------------------------
function publishEvent(topic, payload) {
  console.log(`[event] ${topic}`, JSON.stringify(payload));
  // TODO: replace with real event bus (Kafka, SNS, etc.)
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Get all open positions for an account.
 *
 * @param {string} accountId
 * @returns {Promise<{ accountId: string, positions: object[] }>}
 */
async function listPositions(accountId) {
  ensureAccount(accountId);
  const positions = positionsStore.get(accountId);
  const result = [];

  for (const [symbol, position] of positions.entries()) {
    if (position.status === 'open') {
      const currentPrice = await fetchCurrentPrice(symbol);
      const marketValue = position.quantity * currentPrice;
      const unrealizedPnl = marketValue - position.totalCostBasis;
      const unrealizedPnlPercent =
        position.totalCostBasis > 0
          ? (unrealizedPnl / position.totalCostBasis) * 100
          : 0;

      result.push({
        ...position,
        currentPrice,
        marketValue: parseFloat(marketValue.toFixed(2)),
        unrealizedPnl: parseFloat(unrealizedPnl.toFixed(2)),
        unrealizedPnlPercent: parseFloat(unrealizedPnlPercent.toFixed(2)),
      });
    }
  }

  return { accountId, positions: result };
}

/**
 * Get position details for a single security in an account.
 *
 * @param {string} accountId
 * @param {string} symbol
 * @returns {Promise<object>}
 */
async function getPosition(accountId, symbol) {
  ensureAccount(accountId);
  const positions = positionsStore.get(accountId);
  const upperSymbol = symbol.toUpperCase();

  if (!positions.has(upperSymbol)) {
    const err = new Error(
      `Position not found for symbol ${upperSymbol} in account ${accountId}`
    );
    err.status = 404;
    throw err;
  }

  const position = positions.get(upperSymbol);
  const currentPrice = await fetchCurrentPrice(upperSymbol);
  const marketValue = position.quantity * currentPrice;
  const unrealizedPnl = marketValue - position.totalCostBasis;
  const unrealizedPnlPercent =
    position.totalCostBasis > 0
      ? (unrealizedPnl / position.totalCostBasis) * 100
      : 0;

  return {
    ...position,
    currentPrice,
    marketValue: parseFloat(marketValue.toFixed(2)),
    unrealizedPnl: parseFloat(unrealizedPnl.toFixed(2)),
    unrealizedPnlPercent: parseFloat(unrealizedPnlPercent.toFixed(2)),
  };
}

/**
 * Calculate realized and unrealized P&L for an entire portfolio.
 *
 * @param {string} accountId
 * @returns {Promise<object>}
 */
async function calculatePnl(accountId) {
  ensureAccount(accountId);
  const positions = positionsStore.get(accountId);
  const pnlEntries = [];
  let totalUnrealizedPnl = 0;

  for (const [symbol, position] of positions.entries()) {
    if (position.status !== 'open') continue;

    const currentPrice = await fetchCurrentPrice(symbol);
    const marketValue = position.quantity * currentPrice;
    const unrealizedPnl = marketValue - position.totalCostBasis;
    const unrealizedPnlPercent =
      position.totalCostBasis > 0
        ? (unrealizedPnl / position.totalCostBasis) * 100
        : 0;

    totalUnrealizedPnl += unrealizedPnl;

    pnlEntries.push({
      symbol,
      quantity: position.quantity,
      averageCostBasis: position.averageCostBasis,
      totalCostBasis: position.totalCostBasis,
      currentPrice,
      marketValue: parseFloat(marketValue.toFixed(2)),
      unrealizedPnl: parseFloat(unrealizedPnl.toFixed(2)),
      unrealizedPnlPercent: parseFloat(unrealizedPnlPercent.toFixed(2)),
    });
  }

  const realizedPnl = realizedPnlStore.get(accountId) || 0;
  const totalPnl = realizedPnl + totalUnrealizedPnl;

  return {
    accountId,
    realizedPnl: parseFloat(realizedPnl.toFixed(2)),
    unrealizedPnl: parseFloat(totalUnrealizedPnl.toFixed(2)),
    totalPnl: parseFloat(totalPnl.toFixed(2)),
    calculatedAt: new Date().toISOString(),
    positions: pnlEntries,
  };
}

/**
 * Get position history and cost basis lot details for a specific security.
 *
 * @param {string} accountId
 * @param {string} symbol
 * @returns {Promise<object>}
 */
async function getPositionHistory(accountId, symbol) {
  ensureAccount(accountId);
  const upperSymbol = symbol.toUpperCase();

  const positions = positionsStore.get(accountId);
  if (!positions.has(upperSymbol)) {
    const err = new Error(
      `Position not found for symbol ${upperSymbol} in account ${accountId}`
    );
    err.status = 404;
    throw err;
  }

  const accountLots = lotsStore.get(accountId);
  const lots = accountLots.get(upperSymbol) || [];

  const accountTransactions = transactionsStore.get(accountId);
  const txns = accountTransactions.get(upperSymbol) || [];

  const position = positions.get(upperSymbol);

  return {
    accountId,
    symbol: upperSymbol,
    currentPosition: position,
    lots,
    transactions: txns,
  };
}

/**
 * Record a corporate action adjustment against a position.
 *
 * Supported action types:
 *   split          — multiply quantity by splitRatio, divide cost basis
 *   reverse_split  — divide quantity by splitRatio, multiply cost basis
 *   cash_dividend  — credit dividendAmount per share (adds to realized P&L, no position change)
 *   stock_dividend — add shares at zero cost basis per dividend ratio
 *   spin_off       — create a new position in child company
 *
 * @param {string} accountId
 * @param {string} symbol
 * @param {object} action
 * @param {string} action.actionType
 * @param {string} action.effectiveDate
 * @param {number} [action.splitRatio]
 * @param {number} [action.dividendAmount]
 * @param {string} [action.spinOffSymbol]
 * @param {number} [action.spinOffRatio]
 * @param {string} [action.notes]
 * @returns {Promise<object>}
 */
async function applyCorporateAction(accountId, symbol, action) {
  ensureAccount(accountId);
  const upperSymbol = symbol.toUpperCase();

  const positions = positionsStore.get(accountId);
  if (!positions.has(upperSymbol)) {
    const err = new Error(
      `Position not found for symbol ${upperSymbol} in account ${accountId}`
    );
    err.status = 404;
    throw err;
  }

  const position = positions.get(upperSymbol);
  const accountLots = lotsStore.get(accountId);
  const lots = accountLots.get(upperSymbol) || [];
  const accountTransactions = transactionsStore.get(accountId);
  const txns = accountTransactions.get(upperSymbol) || [];

  const { actionType, effectiveDate, splitRatio, dividendAmount, spinOffSymbol, spinOffRatio, notes } = action;
  const now = new Date().toISOString();

  let updatedPosition = { ...position, updatedAt: now };
  let adjustmentDetails = {};

  switch (actionType) {
    case 'split': {
      if (!splitRatio || splitRatio <= 0) {
        const err = new Error('splitRatio must be a positive number for split actions');
        err.status = 400;
        throw err;
      }
      const newQuantity = Math.round(position.quantity * splitRatio);
      const newAvgCostBasis = position.averageCostBasis / splitRatio;
      updatedPosition = {
        ...updatedPosition,
        quantity: newQuantity,
        averageCostBasis: parseFloat(newAvgCostBasis.toFixed(6)),
        totalCostBasis: parseFloat((newQuantity * newAvgCostBasis).toFixed(2)),
      };
      // Adjust lots
      lots.forEach((lot) => {
        lot.quantity = Math.round(lot.quantity * splitRatio);
        lot.remainingQuantity = Math.round(lot.remainingQuantity * splitRatio);
        lot.costBasis = parseFloat((lot.costBasis / splitRatio).toFixed(6));
      });
      adjustmentDetails = { splitRatio, previousQuantity: position.quantity, newQuantity };
      txns.push({
        transactionId: uuidv4(),
        type: 'split',
        quantity: newQuantity - position.quantity,
        price: 0,
        fees: 0,
        realizedPnl: null,
        executedAt: effectiveDate || now,
        notes: notes || `Stock split ${splitRatio}:1`,
      });
      break;
    }

    case 'reverse_split': {
      if (!splitRatio || splitRatio <= 0) {
        const err = new Error('splitRatio must be a positive number for reverse_split actions');
        err.status = 400;
        throw err;
      }
      const newQuantity = Math.floor(position.quantity / splitRatio);
      const cashForFractional = ((position.quantity / splitRatio) - newQuantity) * position.averageCostBasis * splitRatio;
      const newAvgCostBasis = position.averageCostBasis * splitRatio;
      updatedPosition = {
        ...updatedPosition,
        quantity: newQuantity,
        averageCostBasis: parseFloat(newAvgCostBasis.toFixed(6)),
        totalCostBasis: parseFloat((newQuantity * newAvgCostBasis).toFixed(2)),
      };
      lots.forEach((lot) => {
        lot.quantity = Math.floor(lot.quantity / splitRatio);
        lot.remainingQuantity = Math.floor(lot.remainingQuantity / splitRatio);
        lot.costBasis = parseFloat((lot.costBasis * splitRatio).toFixed(6));
      });
      adjustmentDetails = {
        splitRatio,
        previousQuantity: position.quantity,
        newQuantity,
        cashForFractionalShares: parseFloat(cashForFractional.toFixed(2)),
      };
      txns.push({
        transactionId: uuidv4(),
        type: 'reverse_split',
        quantity: -(position.quantity - newQuantity),
        price: 0,
        fees: 0,
        realizedPnl: null,
        executedAt: effectiveDate || now,
        notes: notes || `Reverse stock split 1:${splitRatio}`,
      });
      break;
    }

    case 'cash_dividend': {
      if (!dividendAmount || dividendAmount <= 0) {
        const err = new Error('dividendAmount must be a positive number for cash_dividend actions');
        err.status = 400;
        throw err;
      }
      const totalDividend = position.quantity * dividendAmount;
      const currentRealized = realizedPnlStore.get(accountId) || 0;
      realizedPnlStore.set(accountId, currentRealized + totalDividend);
      adjustmentDetails = {
        dividendPerShare: dividendAmount,
        totalDividend: parseFloat(totalDividend.toFixed(2)),
        sharesAtRecord: position.quantity,
      };
      txns.push({
        transactionId: uuidv4(),
        type: 'dividend',
        quantity: 0,
        price: dividendAmount,
        fees: 0,
        realizedPnl: parseFloat(totalDividend.toFixed(2)),
        executedAt: effectiveDate || now,
        notes: notes || `Cash dividend $${dividendAmount}/share`,
      });
      // Position itself does not change for cash dividends
      break;
    }

    case 'stock_dividend': {
      if (!dividendAmount || dividendAmount <= 0) {
        const err = new Error('dividendAmount (ratio) must be positive for stock_dividend actions');
        err.status = 400;
        throw err;
      }
      const additionalShares = Math.floor(position.quantity * dividendAmount);
      const newQuantity = position.quantity + additionalShares;
      const newTotalCostBasis = position.totalCostBasis; // new shares at zero cost
      const newAvgCostBasis = newTotalCostBasis / newQuantity;
      updatedPosition = {
        ...updatedPosition,
        quantity: newQuantity,
        averageCostBasis: parseFloat(newAvgCostBasis.toFixed(6)),
        totalCostBasis: parseFloat(newTotalCostBasis.toFixed(2)),
      };
      lots.push({
        lotId: uuidv4(),
        acquiredAt: effectiveDate || now,
        quantity: additionalShares,
        costBasis: 0,
        remainingQuantity: additionalShares,
      });
      adjustmentDetails = {
        dividendRatio: dividendAmount,
        additionalShares,
        previousQuantity: position.quantity,
        newQuantity,
      };
      txns.push({
        transactionId: uuidv4(),
        type: 'stock_dividend',
        quantity: additionalShares,
        price: 0,
        fees: 0,
        realizedPnl: null,
        executedAt: effectiveDate || now,
        notes: notes || `Stock dividend ${dividendAmount * 100}%`,
      });
      break;
    }

    case 'spin_off': {
      if (!spinOffSymbol || !spinOffRatio || spinOffRatio <= 0) {
        const err = new Error('spinOffSymbol and a positive spinOffRatio are required for spin_off actions');
        err.status = 400;
        throw err;
      }
      const childSymbol = spinOffSymbol.toUpperCase();
      const childShares = Math.floor(position.quantity * spinOffRatio);

      // Cost basis allocation: simple 50/50 — real implementations use IRS Form 8937 ratios
      const parentCostBasisAllocation = 0.5;
      const newParentTotalCostBasis = position.totalCostBasis * parentCostBasisAllocation;
      const childTotalCostBasis = position.totalCostBasis * (1 - parentCostBasisAllocation);
      const newAvgCostBasis = newParentTotalCostBasis / position.quantity;

      updatedPosition = {
        ...updatedPosition,
        averageCostBasis: parseFloat(newAvgCostBasis.toFixed(6)),
        totalCostBasis: parseFloat(newParentTotalCostBasis.toFixed(2)),
      };

      // Create child position
      const childPosition = {
        positionId: uuidv4(),
        accountId,
        symbol: childSymbol,
        quantity: childShares,
        averageCostBasis: parseFloat((childTotalCostBasis / childShares).toFixed(6)),
        totalCostBasis: parseFloat(childTotalCostBasis.toFixed(2)),
        currentPrice: 0,
        marketValue: 0,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        openedAt: effectiveDate || now,
        updatedAt: now,
        status: 'open',
      };
      positions.set(childSymbol, childPosition);

      const childLots = [
        {
          lotId: uuidv4(),
          acquiredAt: effectiveDate || now,
          quantity: childShares,
          costBasis: parseFloat((childTotalCostBasis / childShares).toFixed(6)),
          remainingQuantity: childShares,
        },
      ];
      accountLots.set(childSymbol, childLots);

      const childTxns = [
        {
          transactionId: uuidv4(),
          type: 'spin_off',
          quantity: childShares,
          price: parseFloat((childTotalCostBasis / childShares).toFixed(6)),
          fees: 0,
          realizedPnl: null,
          executedAt: effectiveDate || now,
          notes: notes || `Spin-off from ${upperSymbol}`,
        },
      ];
      accountTransactions.set(childSymbol, childTxns);

      adjustmentDetails = {
        spinOffSymbol: childSymbol,
        spinOffRatio,
        childSharesReceived: childShares,
        parentCostBasisAllocationPercent: parentCostBasisAllocation * 100,
        newParentTotalCostBasis: parseFloat(newParentTotalCostBasis.toFixed(2)),
        childTotalCostBasis: parseFloat(childTotalCostBasis.toFixed(2)),
      };

      txns.push({
        transactionId: uuidv4(),
        type: 'spin_off',
        quantity: 0,
        price: 0,
        fees: 0,
        realizedPnl: null,
        executedAt: effectiveDate || now,
        notes: notes || `Spin-off: received ${childShares} shares of ${childSymbol}`,
      });

      // Publish position.opened for child
      publishEvent('position.opened', {
        eventId: uuidv4(),
        accountId,
        symbol: childSymbol,
        quantity: childShares,
        averageCostBasis: childPosition.averageCostBasis,
        totalCostBasis: childPosition.totalCostBasis,
        openedAt: childPosition.openedAt,
      });
      break;
    }

    default: {
      const err = new Error(
        `Unsupported actionType: ${actionType}. Supported types: split, reverse_split, cash_dividend, stock_dividend, spin_off`
      );
      err.status = 400;
      throw err;
    }
  }

  positions.set(upperSymbol, updatedPosition);
  accountLots.set(upperSymbol, lots);
  accountTransactions.set(upperSymbol, txns);

  publishEvent('portfolio.rebalanced', {
    eventId: uuidv4(),
    accountId,
    symbol: upperSymbol,
    actionType,
    adjustmentDetails,
    rebalancedAt: now,
  });

  return {
    accountId,
    symbol: upperSymbol,
    action: {
      actionType,
      effectiveDate: effectiveDate || now,
      adjustmentDetails,
      notes: notes || null,
    },
    updatedPosition,
  };
}

/**
 * Internal helper used by the trading service integration layer to open or
 * update a position when a trade fills.  Not exposed via HTTP directly but
 * called by the route layer when creating positions programmatically.
 *
 * @param {string} accountId
 * @param {string} symbol
 * @param {number} quantity  positive = buy, negative = sell
 * @param {number} executionPrice
 * @param {number} [fees]
 * @param {string} [notes]
 * @returns {Promise<object>}  updated position
 */
async function applyTradeFill(accountId, symbol, quantity, executionPrice, fees = 0, notes = '') {
  ensureAccount(accountId);
  const upperSymbol = symbol.toUpperCase();
  const positions = positionsStore.get(accountId);
  const accountLots = lotsStore.get(accountId);
  const accountTransactions = transactionsStore.get(accountId);
  const now = new Date().toISOString();

  if (!accountLots.has(upperSymbol)) accountLots.set(upperSymbol, []);
  if (!accountTransactions.has(upperSymbol)) accountTransactions.set(upperSymbol, []);

  const lots = accountLots.get(upperSymbol);
  const txns = accountTransactions.get(upperSymbol);

  let realizedPnl = null;
  let isNewPosition = false;

  if (quantity > 0) {
    // BUY: add a new lot
    lots.push({
      lotId: uuidv4(),
      acquiredAt: now,
      quantity,
      costBasis: executionPrice,
      remainingQuantity: quantity,
    });

    if (!positions.has(upperSymbol)) {
      isNewPosition = true;
      positions.set(upperSymbol, {
        positionId: uuidv4(),
        accountId,
        symbol: upperSymbol,
        quantity: 0,
        averageCostBasis: 0,
        totalCostBasis: 0,
        currentPrice: executionPrice,
        marketValue: 0,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        openedAt: now,
        updatedAt: now,
        status: 'open',
      });
    }

    txns.push({
      transactionId: uuidv4(),
      type: 'buy',
      quantity,
      price: executionPrice,
      fees,
      realizedPnl: null,
      executedAt: now,
      notes,
    });
  } else if (quantity < 0) {
    // SELL: consume lots FIFO
    let remaining = Math.abs(quantity);
    realizedPnl = 0;

    for (const lot of lots) {
      if (remaining <= 0) break;
      const consumed = Math.min(lot.remainingQuantity, remaining);
      realizedPnl += consumed * (executionPrice - lot.costBasis);
      lot.remainingQuantity -= consumed;
      remaining -= consumed;
    }

    if (remaining > 0) {
      const err = new Error(`Insufficient position to sell ${Math.abs(quantity)} shares of ${upperSymbol}`);
      err.status = 422;
      throw err;
    }

    const currentRealized = realizedPnlStore.get(accountId) || 0;
    realizedPnlStore.set(accountId, currentRealized + realizedPnl);

    txns.push({
      transactionId: uuidv4(),
      type: 'sell',
      quantity: Math.abs(quantity),
      price: executionPrice,
      fees,
      realizedPnl: parseFloat(realizedPnl.toFixed(2)),
      executedAt: now,
      notes,
    });
  }

  // Recalculate position from remaining lots
  const remainingQuantity = lots.reduce((s, l) => s + l.remainingQuantity, 0);
  const remainingCostBasis = lots.reduce(
    (s, l) => s + l.remainingQuantity * l.costBasis,
    0
  );

  if (remainingQuantity === 0) {
    // Position fully closed
    const position = positions.get(upperSymbol);
    if (position) {
      position.quantity = 0;
      position.averageCostBasis = 0;
      position.totalCostBasis = 0;
      position.status = 'closed';
      position.updatedAt = now;

      publishEvent('position.closed', {
        eventId: uuidv4(),
        accountId,
        symbol: upperSymbol,
        realizedPnl: parseFloat((realizedPnl || 0).toFixed(2)),
        closedAt: now,
      });
    }
    return positions.get(upperSymbol);
  }

  const avgCostBasis = remainingCostBasis / remainingQuantity;
  const updatedPosition = {
    ...positions.get(upperSymbol),
    quantity: remainingQuantity,
    averageCostBasis: parseFloat(avgCostBasis.toFixed(6)),
    totalCostBasis: parseFloat(remainingCostBasis.toFixed(2)),
    updatedAt: now,
    status: 'open',
  };
  positions.set(upperSymbol, updatedPosition);

  if (isNewPosition) {
    publishEvent('position.opened', {
      eventId: uuidv4(),
      accountId,
      symbol: upperSymbol,
      quantity: updatedPosition.quantity,
      averageCostBasis: updatedPosition.averageCostBasis,
      totalCostBasis: updatedPosition.totalCostBasis,
      openedAt: updatedPosition.openedAt,
    });
  } else {
    publishEvent('position.updated', {
      eventId: uuidv4(),
      accountId,
      symbol: upperSymbol,
      quantity: updatedPosition.quantity,
      averageCostBasis: updatedPosition.averageCostBasis,
      totalCostBasis: updatedPosition.totalCostBasis,
      updatedAt: updatedPosition.updatedAt,
    });
  }

  return updatedPosition;
}

module.exports = {
  listPositions,
  getPosition,
  calculatePnl,
  getPositionHistory,
  applyCorporateAction,
  applyTradeFill,
};
