'use strict';

const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

/**
 * derivativeOrders: map of orderId -> DerivativeOrder
 */
const derivativeOrders = new Map();

/**
 * derivativeInstruments: map of derivativeId -> DerivativeInstrument
 * Master instrument definitions for all derivative types.
 */
const derivativeInstruments = new Map([
  [
    'DERIV-OPT-AAPL-20240119-150-CALL',
    {
      derivativeId: 'DERIV-OPT-AAPL-20240119-150-CALL',
      instrumentType: 'OPTION',
      symbol: 'AAPL240119C00150000',
      underlyingSymbol: 'AAPL',
      strikePrice: 150.0,
      expirationDate: '2024-01-19',
      optionType: 'CALL',
      multiplier: 100,
      settlementType: 'PHYSICAL',
      currentBid: 5.2,
      currentAsk: 5.4,
      lastPrice: 5.3,
      impliedVolatility: 0.28,
      delta: 0.52,
      gamma: 0.04,
      theta: -0.07,
      vega: 0.18,
      rho: 0.03,
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    'DERIV-OPT-TSLA-20240216-200-CALL',
    {
      derivativeId: 'DERIV-OPT-TSLA-20240216-200-CALL',
      instrumentType: 'OPTION',
      symbol: 'TSLA240216C00200000',
      underlyingSymbol: 'TSLA',
      strikePrice: 200.0,
      expirationDate: '2024-02-16',
      optionType: 'CALL',
      multiplier: 100,
      settlementType: 'PHYSICAL',
      currentBid: 14.5,
      currentAsk: 14.8,
      lastPrice: 14.6,
      impliedVolatility: 0.65,
      delta: 0.48,
      gamma: 0.02,
      theta: -0.15,
      vega: 0.42,
      rho: 0.05,
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    'DERIV-FUT-ES-20240315',
    {
      derivativeId: 'DERIV-FUT-ES-20240315',
      instrumentType: 'FUTURE',
      symbol: 'ESH24',
      underlyingSymbol: 'SPX',
      contractSize: 50,
      expirationDate: '2024-03-15',
      tickSize: 0.25,
      tickValue: 12.5,
      settlementType: 'CASH',
      currentBid: 4520.0,
      currentAsk: 4520.25,
      lastPrice: 4520.1,
      impliedVolatility: null,
      delta: 1.0,
      gamma: 0.0,
      theta: 0.0,
      vega: 0.0,
      rho: 0.0,
      updatedAt: new Date().toISOString(),
    },
  ],
  [
    'DERIV-FUT-CL-20240220',
    {
      derivativeId: 'DERIV-FUT-CL-20240220',
      instrumentType: 'FUTURE',
      symbol: 'CLG24',
      underlyingSymbol: 'CRUDE_OIL',
      contractSize: 1000,
      expirationDate: '2024-02-20',
      tickSize: 0.01,
      tickValue: 10.0,
      settlementType: 'PHYSICAL',
      currentBid: 73.4,
      currentAsk: 73.45,
      lastPrice: 73.42,
      impliedVolatility: null,
      delta: 1.0,
      gamma: 0.0,
      theta: 0.0,
      vega: 0.0,
      rho: 0.0,
      updatedAt: new Date().toISOString(),
    },
  ],
]);

/**
 * expirationNotices: array of ExpirationNotice
 */
const expirationNotices = [
  {
    noticeId: 'EXP-NOTICE-001',
    derivativeId: 'DERIV-OPT-AAPL-20240119-150-CALL',
    symbol: 'AAPL240119C00150000',
    instrumentType: 'OPTION',
    expirationDate: '2024-01-19',
    daysToExpiration: 5,
    assignmentNotices: [],
    status: 'PENDING',
  },
  {
    noticeId: 'EXP-NOTICE-002',
    derivativeId: 'DERIV-FUT-ES-20240315',
    symbol: 'ESH24',
    instrumentType: 'FUTURE',
    expirationDate: '2024-03-15',
    daysToExpiration: 60,
    assignmentNotices: [],
    status: 'PENDING',
  },
  {
    noticeId: 'EXP-NOTICE-003',
    derivativeId: 'DERIV-FUT-CL-20240220',
    symbol: 'CLG24',
    instrumentType: 'FUTURE',
    expirationDate: '2024-02-20',
    daysToExpiration: 18,
    assignmentNotices: [],
    status: 'PENDING',
  },
];

// ---------------------------------------------------------------------------
// Black-Scholes Greeks calculation (simplified)
// ---------------------------------------------------------------------------

/**
 * Standard normal CDF approximation (Abramowitz and Stegun)
 */
function normCDF(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422820 * Math.exp((-x * x) / 2);
  const poly =
    t * (0.319381530 +
      t * (-0.356563782 +
        t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const result = 1 - d * poly;
  return x >= 0 ? result : 1 - result;
}

function normPDF(x) {
  return Math.exp((-x * x) / 2) / Math.sqrt(2 * Math.PI);
}

/**
 * Calculate Black-Scholes Greeks for a European option.
 */
function calculateBlackScholesGreeks({ S, K, T, r, sigma, optionType }) {
  if (T <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
  }

  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  const nd1 = normCDF(d1);
  const nd2 = normCDF(d2);
  const nNd1 = normCDF(-d1);
  const nNd2 = normCDF(-d2);
  const npd1 = normPDF(d1);

  let delta, theta, rho;

  if (optionType === 'CALL') {
    delta = nd1;
    theta =
      (-(S * npd1 * sigma) / (2 * Math.sqrt(T)) -
        r * K * Math.exp(-r * T) * nd2) /
      365;
    rho = (K * T * Math.exp(-r * T) * nd2) / 100;
  } else {
    delta = nd1 - 1;
    theta =
      (-(S * npd1 * sigma) / (2 * Math.sqrt(T)) +
        r * K * Math.exp(-r * T) * nNd2) /
      365;
    rho = (-K * T * Math.exp(-r * T) * nNd2) / 100;
  }

  const gamma = npd1 / (S * sigma * Math.sqrt(T));
  const vega = (S * npd1 * Math.sqrt(T)) / 100;

  return {
    delta: parseFloat(delta.toFixed(6)),
    gamma: parseFloat(gamma.toFixed(6)),
    theta: parseFloat(theta.toFixed(6)),
    vega: parseFloat(vega.toFixed(6)),
    rho: parseFloat(rho.toFixed(6)),
  };
}

// Simulated underlying spot prices
const spotPrices = {
  AAPL: 152.34,
  TSLA: 198.75,
  MSFT: 375.1,
  SPX: 4520.0,
  CRUDE_OIL: 73.42,
};

const RISK_FREE_RATE = 0.053; // approximate 5.3% risk-free rate

// ---------------------------------------------------------------------------
// Exported service functions
// ---------------------------------------------------------------------------

/**
 * Submit a new derivative order.
 */
async function submitOrder({
  accountId,
  instrumentType,
  symbol,
  side,
  quantity,
  orderType,
  limitPrice,
  expiration,
}) {
  const orderId = `DORD-${uuidv4()}`;
  const now = new Date().toISOString();

  const order = {
    orderId,
    accountId,
    instrumentType,
    symbol,
    side,
    quantity,
    orderType,
    limitPrice: limitPrice ?? null,
    expiration: expiration ?? null,
    status: 'PENDING',
    filledQuantity: 0,
    averageFillPrice: null,
    commission: 0.65 * quantity,
    submittedAt: now,
    updatedAt: now,
  };

  derivativeOrders.set(orderId, order);

  // Simulate immediate fill for MARKET orders
  if (orderType === 'MARKET') {
    order.status = 'FILLED';
    order.filledQuantity = quantity;
    order.averageFillPrice = limitPrice ?? getSimulatedMidPrice(symbol);
    order.updatedAt = new Date().toISOString();

    emitEvent('derivative.position_opened', {
      orderId,
      accountId,
      instrumentType,
      symbol,
      side,
      quantity,
      openPrice: order.averageFillPrice,
      openedAt: order.updatedAt,
    });
  }

  return order;
}

/**
 * Get a derivative order by ID.
 */
async function getOrder(orderId) {
  const order = derivativeOrders.get(orderId);
  if (!order) {
    const err = new Error(`Derivative order not found: ${orderId}`);
    err.status = 404;
    throw err;
  }
  return order;
}

/**
 * List all derivative orders.
 */
async function listOrders() {
  return Array.from(derivativeOrders.values());
}

/**
 * Get expiration schedules and assignment notices.
 */
async function getExpirations() {
  const now = new Date();
  const enriched = expirationNotices.map((notice) => {
    const expDate = new Date(notice.expirationDate);
    const daysToExpiration = Math.max(
      0,
      Math.ceil((expDate - now) / (1000 * 60 * 60 * 24))
    );
    return { ...notice, daysToExpiration };
  });

  return {
    retrievedAt: now.toISOString(),
    count: enriched.length,
    expirations: enriched,
  };
}

/**
 * Get Greeks for a specific derivative instrument.
 * @param {string} derivativeId
 */
async function getGreeks(derivativeId) {
  const instrument = derivativeInstruments.get(derivativeId);
  if (!instrument) {
    const err = new Error(`Derivative instrument not found: ${derivativeId}`);
    err.status = 404;
    throw err;
  }

  const now = new Date();

  // Futures always have delta=1, no other Greeks
  if (instrument.instrumentType === 'FUTURE') {
    const greeks = {
      derivativeId,
      symbol: instrument.symbol,
      instrumentType: 'FUTURE',
      underlyingSymbol: instrument.underlyingSymbol,
      delta: 1.0,
      gamma: 0.0,
      theta: 0.0,
      vega: 0.0,
      rho: 0.0,
      impliedVolatility: null,
      calculatedAt: now.toISOString(),
    };
    emitEvent('derivative.greeks_updated', greeks);
    return greeks;
  }

  // Option Greeks via Black-Scholes
  const S = spotPrices[instrument.underlyingSymbol] ?? 100;
  const K = instrument.strikePrice;
  const expirationDate = new Date(instrument.expirationDate);
  const T = Math.max(0, (expirationDate - now) / (1000 * 60 * 60 * 24 * 365));
  const sigma = instrument.impliedVolatility ?? 0.3;

  const bsGreeks = calculateBlackScholesGreeks({
    S,
    K,
    T,
    r: RISK_FREE_RATE,
    sigma,
    optionType: instrument.optionType,
  });

  const greeks = {
    derivativeId,
    symbol: instrument.symbol,
    instrumentType: 'OPTION',
    underlyingSymbol: instrument.underlyingSymbol,
    underlyingPrice: S,
    strikePrice: K,
    timeToExpiration: parseFloat(T.toFixed(6)),
    impliedVolatility: sigma,
    ...bsGreeks,
    calculatedAt: now.toISOString(),
  };

  // Update stored greeks
  Object.assign(instrument, bsGreeks, { updatedAt: now.toISOString() });

  emitEvent('derivative.greeks_updated', greeks);

  return greeks;
}

/**
 * Get a derivative instrument definition by ID.
 */
async function getInstrument(derivativeId) {
  const instrument = derivativeInstruments.get(derivativeId);
  if (!instrument) {
    const err = new Error(`Derivative instrument not found: ${derivativeId}`);
    err.status = 404;
    throw err;
  }
  return instrument;
}

/**
 * List all derivative instruments.
 */
async function listInstruments() {
  return Array.from(derivativeInstruments.values());
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSimulatedMidPrice(symbol) {
  for (const inst of derivativeInstruments.values()) {
    if (inst.symbol === symbol) {
      return (inst.currentBid + inst.currentAsk) / 2;
    }
  }
  return 0;
}

function emitEvent(topic, payload) {
  console.log(`[event:${topic}]`, JSON.stringify({ ...payload, _eventId: uuidv4() }));
}

module.exports = {
  submitOrder,
  getOrder,
  listOrders,
  getExpirations,
  getGreeks,
  getInstrument,
  listInstruments,
};
