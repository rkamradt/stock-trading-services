'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory stores for the orders domain.
 *
 * orders:     Map<orderId, Order>
 * executions: Map<executionId, Execution>
 * trades:     Map<tradeId, Trade>
 *
 * These stores are also shared / referenced by the accounts service via
 * getOrdersByAccountId / getTradesByAccountId helpers exported below.
 */
const orders = new Map();
const executions = new Map();
const trades = new Map();

// ---------------------------------------------------------------------------
// Order status constants
// ---------------------------------------------------------------------------
const ORDER_STATUS = {
  PENDING: 'PENDING',
  OPEN: 'OPEN',
  PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  FILLED: 'FILLED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
};

const CANCELLABLE_STATUSES = new Set([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.OPEN,
  ORDER_STATUS.PARTIALLY_FILLED,
]);

const MODIFIABLE_STATUSES = new Set([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.OPEN,
]);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Simulate an execution venue price for a given symbol.
 * In a real service this would call market-data-provider.
 * Returns a realistic-looking mid-market price with slight random spread.
 */
function simulateMarketPrice(symbol) {
  // Deterministic base price derived from symbol characters so tests are repeatable
  const base = symbol.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0) % 900 + 50;
  const jitter = parseFloat((Math.random() * 2 - 1).toFixed(4));
  return parseFloat((base + jitter).toFixed(4));
}

/**
 * Calculate commission / fees for a trade.
 * Simple flat-rate model: $0.005 per share, min $1.00.
 */
function calculateFees(quantity, executedPrice) {
  const perShareFee = 0.005;
  const raw = quantity * perShareFee;
  return parseFloat(Math.max(raw, 1.0).toFixed(4));
}

/**
 * Derive fill price from order type.
 */
function determineFillPrice(order) {
  switch (order.orderType) {
    case 'LIMIT':
      return order.limitPrice;
    case 'STOP':
      return order.stopPrice;
    case 'STOP_LIMIT':
      return order.limitPrice;
    case 'MARKET':
    default:
      return simulateMarketPrice(order.symbol);
  }
}

/**
 * Emit an event to the event bus (stubbed — logs to stdout).
 * In production this would publish to Kafka / RabbitMQ / SNS.
 */
function emitEvent(topic, payload) {
  console.log(`[trading-service] EVENT ${topic}:`, JSON.stringify(payload));
}

/**
 * Build a deep-cloned public Order object (including its executions array).
 */
function buildOrderView(order) {
  const orderExecutions = [...executions.values()]
    .filter((e) => e.orderId === order.orderId)
    .sort((a, b) => new Date(a.executedAt) - new Date(b.executedAt));

  return { ...order, executions: orderExecutions };
}

/**
 * Attempt to fill the order immediately (simulates straight-through processing).
 * For LIMIT / STOP orders we simulate a partial fill scenario ~20% of the time.
 */
function attemptFill(order) {
  const now = new Date().toISOString();

  // Determine fill quantity (80% full fill, 20% partial for non-market orders)
  let fillQty = order.remainingQuantity;
  if (order.orderType !== 'MARKET' && Math.random() < 0.2) {
    fillQty = parseFloat((order.remainingQuantity * (0.4 + Math.random() * 0.4)).toFixed(6));
  }

  const fillPrice = determineFillPrice(order);
  const fees = calculateFees(fillQty, fillPrice);
  const netAmount = parseFloat(
    (fillQty * fillPrice + (order.side === 'BUY' ? fees : -fees)).toFixed(4)
  );
  const venue = 'NYSE_ARCA';

  const tradeId = uuidv4();
  const executionId = uuidv4();

  const execution = {
    executionId,
    orderId: order.orderId,
    tradeId,
    accountId: order.accountId,
    symbol: order.symbol,
    side: order.side,
    executedQuantity: fillQty,
    executedPrice: fillPrice,
    fees,
    venue,
    executedAt: now,
  };

  const trade = {
    tradeId,
    orderId: order.orderId,
    accountId: order.accountId,
    symbol: order.symbol,
    side: order.side,
    executedQuantity: fillQty,
    executedPrice: fillPrice,
    fees,
    netAmount,
    venue,
    executedAt: now,
  };

  executions.set(executionId, execution);
  trades.set(tradeId, trade);

  // Update order fill state
  order.filledQuantity = parseFloat((order.filledQuantity + fillQty).toFixed(6));
  order.remainingQuantity = parseFloat((order.quantity - order.filledQuantity).toFixed(6));

  // Recalculate average fill price (weighted average)
  const previousTotal = order.averageFillPrice
    ? order.averageFillPrice * (order.filledQuantity - fillQty)
    : 0;
  order.averageFillPrice = parseFloat(
    ((previousTotal + fillPrice * fillQty) / order.filledQuantity).toFixed(6)
  );

  const isFullyFilled = order.remainingQuantity <= 0;
  order.status = isFullyFilled ? ORDER_STATUS.FILLED : ORDER_STATUS.PARTIALLY_FILLED;
  order.updatedAt = now;

  if (isFullyFilled) {
    order.filledAt = now;
  }

  orders.set(order.orderId, order);

  // Emit events
  emitEvent('trade.executed', trade);
  emitEvent('order.filled', {
    orderId: order.orderId,
    accountId: order.accountId,
    symbol: order.symbol,
    side: order.side,
    filledQuantity: fillQty,
    remainingQuantity: order.remainingQuantity,
    fillPrice,
    fillStatus: order.status,
    filledAt: now,
  });

  return { execution, trade };
}

// ---------------------------------------------------------------------------
// Public service functions
// ---------------------------------------------------------------------------

/**
 * Submit a new trade order.
 */
async function submitOrder(data) {
  const {
    accountId,
    symbol,
    side,
    orderType,
    quantity,
    limitPrice = null,
    stopPrice = null,
    timeInForce = 'DAY',
    notes = null,
  } = data;

  // Business rule: LIMIT and STOP_LIMIT require limitPrice
  if ((orderType === 'LIMIT' || orderType === 'STOP_LIMIT') && !limitPrice) {
    const err = new Error(`orderType ${orderType} requires a limitPrice`);
    err.status = 422;
    throw err;
  }

  // Business rule: STOP and STOP_LIMIT require stopPrice
  if ((orderType === 'STOP' || orderType === 'STOP_LIMIT') && !stopPrice) {
    const err = new Error(`orderType ${orderType} requires a stopPrice`);
    err.status = 422;
    throw err;
  }

  const now = new Date().toISOString();
  const orderId = uuidv4();
  const qty = parseFloat(parseFloat(quantity).toFixed(6));

  const order = {
    orderId,
    accountId,
    symbol: symbol.toUpperCase(),
    side,
    orderType,
    quantity: qty,
    filledQuantity: 0,
    remainingQuantity: qty,
    limitPrice: limitPrice ? parseFloat(parseFloat(limitPrice).toFixed(6)) : null,
    stopPrice: stopPrice ? parseFloat(parseFloat(stopPrice).toFixed(6)) : null,
    averageFillPrice: null,
    status: ORDER_STATUS.OPEN,
    timeInForce,
    submittedAt: now,
    updatedAt: now,
    filledAt: null,
    cancelledAt: null,
    cancelReason: null,
    notes,
  };

  orders.set(orderId, order);

  emitEvent('order.submitted', {
    orderId,
    accountId,
    symbol: order.symbol,
    side,
    orderType,
    quantity: qty,
    limitPrice: order.limitPrice,
    stopPrice: order.stopPrice,
    timeInForce,
    submittedAt: now,
  });

  // Simulate immediate straight-through execution
  attemptFill(order);

  return buildOrderView(orders.get(orderId));
}

/**
 * Retrieve a single order by ID.
 */
async function getOrder(orderId) {
  const order = orders.get(orderId);
  if (!order) {
    const err = new Error(`Order ${orderId} not found`);
    err.status = 404;
    throw err;
  }
  return buildOrderView(order);
}

/**
 * Cancel a pending order.
 */
async function cancelOrder(orderId, cancelReason) {
  const order = orders.get(orderId);
  if (!order) {
    const err = new Error(`Order ${orderId} not found`);
    err.status = 404;
    throw err;
  }

  if (!CANCELLABLE_STATUSES.has(order.status)) {
    const err = new Error(
      `Order ${orderId} cannot be cancelled in status ${order.status}`
    );
    err.status = 409;
    throw err;
  }

  const now = new Date().toISOString();
  order.status = ORDER_STATUS.CANCELLED;
  order.cancelledAt = now;
  order.cancelReason = cancelReason || 'Cancelled by user';
  order.updatedAt = now;
  orders.set(orderId, order);

  emitEvent('order.cancelled', {
    orderId,
    accountId: order.accountId,
    symbol: order.symbol,
    cancelledAt: now,
    cancelReason: order.cancelReason,
  });

  return buildOrderView(order);
}

/**
 * Modify quantity or price of a pending order.
 */
async function modifyOrder(orderId, modifications) {
  const order = orders.get(orderId);
  if (!order) {
    const err = new Error(`Order ${orderId} not found`);
    err.status = 404;
    throw err;
  }

  if (!MODIFIABLE_STATUSES.has(order.status)) {
    const err = new Error(
      `Order ${orderId} cannot be modified in status ${order.status}`
    );
    err.status = 409;
    throw err;
  }

  const { quantity, limitPrice, stopPrice } = modifications;

  if (quantity != null) {
    const newQty = parseFloat(parseFloat(quantity).toFixed(6));
    if (newQty < order.filledQuantity) {
      const err = new Error(
        `New quantity (${newQty}) cannot be less than already filled quantity (${order.filledQuantity})`
      );
      err.status = 422;
      throw err;
    }
    order.quantity = newQty;
    order.remainingQuantity = parseFloat((newQty - order.filledQuantity).toFixed(6));
  }

  if (limitPrice != null) {
    if (order.orderType !== 'LIMIT' && order.orderType !== 'STOP_LIMIT') {
      const err = new Error(
        `limitPrice can only be modified on LIMIT or STOP_LIMIT orders, got ${order.orderType}`
      );
      err.status = 422;
      throw err;
    }
    order.limitPrice = parseFloat(parseFloat(limitPrice).toFixed(6));
  }

  if (stopPrice != null) {
    if (order.orderType !== 'STOP' && order.orderType !== 'STOP_LIMIT') {
      const err = new Error(
        `stopPrice can only be modified on STOP or STOP_LIMIT orders, got ${order.orderType}`
      );
      err.status = 422;
      throw err;
    }
    order.stopPrice = parseFloat(parseFloat(stopPrice).toFixed(6));
  }

  order.updatedAt = new Date().toISOString();
  orders.set(orderId, order);

  return buildOrderView(order);
}

/**
 * Get all executions for a specific order.
 */
async function getOrderExecutions(orderId) {
  const order = orders.get(orderId);
  if (!order) {
    const err = new Error(`Order ${orderId} not found`);
    err.status = 404;
    throw err;
  }

  return [...executions.values()]
    .filter((e) => e.orderId === orderId)
    .sort((a, b) => new Date(a.executedAt) - new Date(b.executedAt));
}

// ---------------------------------------------------------------------------
// Shared store accessors (used by accounts service)
// ---------------------------------------------------------------------------

/**
 * Return all orders belonging to a given account.
 */
function getOrdersByAccountId(accountId) {
  return [...orders.values()]
    .filter((o) => o.accountId === accountId)
    .map(buildOrderView)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
}

/**
 * Return all trades belonging to a given account.
 */
function getTradesByAccountId(accountId) {
  return [...trades.values()]
    .filter((t) => t.accountId === accountId)
    .sort((a, b) => new Date(b.executedAt) - new Date(a.executedAt));
}

module.exports = {
  submitOrder,
  getOrder,
  cancelOrder,
  modifyOrder,
  getOrderExecutions,
  getOrdersByAccountId,
  getTradesByAccountId,
};
