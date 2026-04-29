'use strict';

const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

/**
 * optionsContracts: map of contractId -> OptionContract
 * Represents known option contracts (instrument definitions).
 */
const optionsContracts = new Map([
  [
    'OPT-AAPL-20240119-150-CALL',
    {
      contractId: 'OPT-AAPL-20240119-150-CALL',
      symbol: 'AAPL240119C00150000',
      underlyingSymbol: 'AAPL',
      strikePrice: 150.0,
      expirationDate: '2024-01-19',
      optionType: 'CALL',
      multiplier: 100,
      bid: 5.2,
      ask: 5.4,
      lastPrice: 5.3,
      volume: 1250,
      openInterest: 8400,
      impliedVolatility: 0.28,
      delta: 0.52,
      gamma: 0.04,
      theta: -0.07,
      vega: 0.18,
    },
  ],
  [
    'OPT-AAPL-20240119-150-PUT',
    {
      contractId: 'OPT-AAPL-20240119-150-PUT',
      symbol: 'AAPL240119P00150000',
      underlyingSymbol: 'AAPL',
      strikePrice: 150.0,
      expirationDate: '2024-01-19',
      optionType: 'PUT',
      multiplier: 100,
      bid: 4.8,
      ask: 5.0,
      lastPrice: 4.9,
      volume: 980,
      openInterest: 6200,
      impliedVolatility: 0.3,
      delta: -0.48,
      gamma: 0.04,
      theta: -0.06,
      vega: 0.17,
    },
  ],
  [
    'OPT-AAPL-20240119-155-CALL',
    {
      contractId: 'OPT-AAPL-20240119-155-CALL',
      symbol: 'AAPL240119C00155000',
      underlyingSymbol: 'AAPL',
      strikePrice: 155.0,
      expirationDate: '2024-01-19',
      optionType: 'CALL',
      multiplier: 100,
      bid: 2.8,
      ask: 3.0,
      lastPrice: 2.9,
      volume: 870,
      openInterest: 5100,
      impliedVolatility: 0.26,
      delta: 0.35,
      gamma: 0.05,
      theta: -0.065,
      vega: 0.15,
    },
  ],
  [
    'OPT-AAPL-20240119-155-PUT',
    {
      contractId: 'OPT-AAPL-20240119-155-PUT',
      symbol: 'AAPL240119P00155000',
      underlyingSymbol: 'AAPL',
      strikePrice: 155.0,
      expirationDate: '2024-01-19',
      optionType: 'PUT',
      multiplier: 100,
      bid: 7.1,
      ask: 7.3,
      lastPrice: 7.2,
      volume: 430,
      openInterest: 3400,
      impliedVolatility: 0.32,
      delta: -0.65,
      gamma: 0.05,
      theta: -0.072,
      vega: 0.16,
    },
  ],
  [
    'OPT-TSLA-20240216-200-CALL',
    {
      contractId: 'OPT-TSLA-20240216-200-CALL',
      symbol: 'TSLA240216C00200000',
      underlyingSymbol: 'TSLA',
      strikePrice: 200.0,
      expirationDate: '2024-02-16',
      optionType: 'CALL',
      multiplier: 100,
      bid: 14.5,
      ask: 14.8,
      lastPrice: 14.6,
      volume: 3100,
      openInterest: 12500,
      impliedVolatility: 0.65,
      delta: 0.48,
      gamma: 0.02,
      theta: -0.15,
      vega: 0.42,
    },
  ],
]);

/**
 * exerciseRecords: map of exerciseId -> ExerciseRecord
 */
const exerciseRecords = new Map();

// ---------------------------------------------------------------------------
// Helper: build options chain for a given underlying symbol
// ---------------------------------------------------------------------------

function buildOptionsChain(underlyingSymbol) {
  const expirationsMap = new Map();

  for (const contract of optionsContracts.values()) {
    if (contract.underlyingSymbol !== underlyingSymbol) continue;

    if (!expirationsMap.has(contract.expirationDate)) {
      expirationsMap.set(contract.expirationDate, { calls: [], puts: [] });
    }

    const bucket = expirationsMap.get(contract.expirationDate);
    if (contract.optionType === 'CALL') {
      bucket.calls.push(contract);
    } else {
      bucket.puts.push(contract);
    }
  }

  const expirations = [];
  for (const [expirationDate, { calls, puts }] of expirationsMap) {
    calls.sort((a, b) => a.strikePrice - b.strikePrice);
    puts.sort((a, b) => a.strikePrice - b.strikePrice);
    expirations.push({ expirationDate, calls, puts });
  }
  expirations.sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));

  return expirations;
}

// Simulated underlying prices (would come from market-data-provider in prod)
const underlyingPrices = {
  AAPL: 152.34,
  TSLA: 198.75,
  MSFT: 375.1,
  SPY: 450.2,
};

// ---------------------------------------------------------------------------
// Exported service functions
// ---------------------------------------------------------------------------

/**
 * Get options chain for a given underlying security symbol.
 * @param {string} symbol - Underlying security ticker (e.g. "AAPL")
 * @returns {object} Options chain grouped by expiration
 */
async function getOptionsChain(symbol) {
  const upperSymbol = symbol.toUpperCase();
  const expirations = buildOptionsChain(upperSymbol);

  return {
    symbol: upperSymbol,
    underlyingPrice: underlyingPrices[upperSymbol] ?? null,
    retrievedAt: new Date().toISOString(),
    expirationCount: expirations.length,
    expirations,
  };
}

/**
 * Exercise an option position.
 * @param {string} optionId - Contract ID or symbol of the option to exercise
 * @param {object} params
 * @param {string} params.accountId
 * @param {number} params.quantity - Number of contracts to exercise
 * @param {string} params.exerciseType - AMERICAN or EUROPEAN
 * @returns {object} Exercise record
 */
async function exerciseOption(optionId, { accountId, quantity, exerciseType }) {
  const contract = optionsContracts.get(optionId);
  if (!contract) {
    const err = new Error(`Option contract not found: ${optionId}`);
    err.status = 404;
    throw err;
  }

  const now = new Date();
  const expirationDate = new Date(contract.expirationDate);

  if (exerciseType === 'EUROPEAN') {
    // European options can only be exercised on expiration date
    const today = now.toISOString().slice(0, 10);
    if (today !== contract.expirationDate) {
      const err = new Error(
        `European option ${optionId} can only be exercised on expiration date ${contract.expirationDate}`
      );
      err.status = 422;
      throw err;
    }
  }

  if (now > expirationDate) {
    const err = new Error(`Option ${optionId} has already expired on ${contract.expirationDate}`);
    err.status = 422;
    throw err;
  }

  const exerciseId = `EX-${uuidv4()}`;
  const underlyingSharesAffected = quantity * contract.multiplier;

  const record = {
    exerciseId,
    optionId,
    contractSymbol: contract.symbol,
    accountId,
    underlyingSymbol: contract.underlyingSymbol,
    optionType: contract.optionType,
    strikePrice: contract.strikePrice,
    quantity,
    underlyingSharesAffected,
    exerciseType,
    status: 'PENDING',
    exercisedAt: now.toISOString(),
  };

  exerciseRecords.set(exerciseId, record);

  // Emit event (in production this would publish to a message broker)
  emitEvent('derivative.exercised', {
    exerciseId,
    optionId,
    accountId,
    quantity,
    strikePrice: contract.strikePrice,
    underlyingSymbol: contract.underlyingSymbol,
    optionType: contract.optionType,
    exercisedAt: record.exercisedAt,
  });

  return record;
}

/**
 * Get an exercise record by ID.
 * @param {string} exerciseId
 */
async function getExerciseRecord(exerciseId) {
  const record = exerciseRecords.get(exerciseId);
  if (!record) {
    const err = new Error(`Exercise record not found: ${exerciseId}`);
    err.status = 404;
    throw err;
  }
  return record;
}

/**
 * List all known option contracts (instrument definitions).
 */
async function listContracts() {
  return Array.from(optionsContracts.values());
}

/**
 * Get a single option contract by contractId.
 * @param {string} contractId
 */
async function getContract(contractId) {
  const contract = optionsContracts.get(contractId);
  if (!contract) {
    const err = new Error(`Option contract not found: ${contractId}`);
    err.status = 404;
    throw err;
  }
  return contract;
}

// ---------------------------------------------------------------------------
// Internal event emission stub (production would use a message broker)
// ---------------------------------------------------------------------------
function emitEvent(topic, payload) {
  console.log(`[event:${topic}]`, JSON.stringify({ ...payload, _eventId: uuidv4() }));
}

module.exports = {
  getOptionsChain,
  exerciseOption,
  getExerciseRecord,
  listContracts,
  getContract,
};
