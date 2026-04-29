'use strict';

const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// In-memory stores
// ---------------------------------------------------------------------------

/**
 * futuresContracts: map of futuresId -> FuturesContract
 * Instrument definitions for all listed futures contracts.
 */
const futuresContracts = new Map([
  [
    'FUT-ES-20240315',
    {
      futuresId: 'FUT-ES-20240315',
      symbol: 'ESH24',
      productCode: 'ES',
      underlyingSymbol: 'SPX',
      exchange: 'CME',
      contractMonth: '2024-03',
      expirationDate: '2024-03-15',
      lastTradingDate: '2024-03-14',
      contractSize: 50,
      tickSize: 0.25,
      tickValue: 12.5,
      currency: 'USD',
      settlementType: 'CASH',
      currentBid: 4520.0,
      currentAsk: 4520.25,
      lastPrice: 4520.1,
      dailyHigh: 4528.5,
      dailyLow: 4510.0,
      openInterest: 2450000,
      volume: 873400,
      status: 'ACTIVE',
    },
  ],
  [
    'FUT-CL-20240220',
    {
      futuresId: 'FUT-CL-20240220',
      symbol: 'CLG24',
      productCode: 'CL',
      underlyingSymbol: 'CRUDE_OIL',
      exchange: 'NYMEX',
      contractMonth: '2024-02',
      expirationDate: '2024-02-20',
      lastTradingDate: '2024-02-16',
      contractSize: 1000,
      tickSize: 0.01,
      tickValue: 10.0,
      currency: 'USD',
      settlementType: 'PHYSICAL',
      currentBid: 73.4,
      currentAsk: 73.45,
      lastPrice: 73.42,
      dailyHigh: 74.1,
      dailyLow: 72.85,
      openInterest: 1890000,
      volume: 521000,
      status: 'ACTIVE',
    },
  ],
  [
    'FUT-ES-20240621',
    {
      futuresId: 'FUT-ES-20240621',
      symbol: 'ESM24',
      productCode: 'ES',
      underlyingSymbol: 'SPX',
      exchange: 'CME',
      contractMonth: '2024-06',
      expirationDate: '2024-06-21',
      lastTradingDate: '2024-06-20',
      contractSize: 50,
      tickSize: 0.25,
      tickValue: 12.5,
      currency: 'USD',
      settlementType: 'CASH',
      currentBid: 4535.0,
      currentAsk: 4535.25,
      lastPrice: 4535.1,
      dailyHigh: 4542.0,
      dailyLow: 4524.0,
      openInterest: 1200000,
      volume: 234000,
      status: 'ACTIVE',
    },
  ],
  [
    'FUT-CL-20240320',
    {
      futuresId: 'FUT-CL-20240320',
      symbol: 'CLJ24',
      productCode: 'CL',
      underlyingSymbol: 'CRUDE_OIL',
      exchange: 'NYMEX',
      contractMonth: '2024-03',
      expirationDate: '2024-03-20',
      lastTradingDate: '2024-03-18',
      contractSize: 1000,
      tickSize: 0.01,
      tickValue: 10.0,
      currency: 'USD',
      settlementType: 'PHYSICAL',
      currentBid: 74.1,
      currentAsk: 74.15,
      lastPrice: 74.12,
      dailyHigh: 74.8,
      dailyLow: 73.6,
      openInterest: 1100000,
      volume: 380000,
      status: 'ACTIVE',
    },
  ],
]);

/**
 * closeAndRollRecords: map of recordId -> FuturesCloseRecord
 */
const closeAndRollRecords = new Map();

// ---------------------------------------------------------------------------
// Exported service functions
// ---------------------------------------------------------------------------

/**
 * Get a futures contract by futuresId.
 * @param {string} futuresId
 */
async function getContract(futuresId) {
  const contract = futuresContracts.get(futuresId);
  if (!contract) {
    const err = new Error(`Futures contract not found: ${futuresId}`);
    err.status = 404;
    throw err;
  }
  return contract;
}

/**
 * List all active futures contracts.
 */
async function listContracts() {
  return Array.from(futuresContracts.values());
}

/**
 * Close or roll a futures position.
 *
 * CLOSE: Liquidates up to `quantity` contracts at current market price.
 * ROLL:  Closes the near-month contract and opens the specified far-month contract.
 *
 * @param {string} futuresId — The near-month contract being closed/rolled
 * @param {object} params
 * @param {string} params.accountId
 * @param {'CLOSE'|'ROLL'} params.action
 * @param {number} params.quantity — Number of contracts to close/roll
 * @param {string} [params.rollToContractId] — Required if action === 'ROLL'
 * @returns {object} Close/roll record
 */
async function closeFutures(futuresId, { accountId, action, quantity, rollToContractId }) {
  const nearContract = futuresContracts.get(futuresId);
  if (!nearContract) {
    const err = new Error(`Futures contract not found: ${futuresId}`);
    err.status = 404;
    throw err;
  }

  if (nearContract.status !== 'ACTIVE') {
    const err = new Error(
      `Futures contract ${futuresId} is not active (status: ${nearContract.status})`
    );
    err.status = 422;
    throw err;
  }

  let farContract = null;
  if (action === 'ROLL') {
    farContract = futuresContracts.get(rollToContractId);
    if (!farContract) {
      const err = new Error(`Roll target futures contract not found: ${rollToContractId}`);
      err.status = 404;
      throw err;
    }
    if (farContract.productCode !== nearContract.productCode) {
      const err = new Error(
        `Cannot roll ${nearContract.productCode} contract to ${farContract.productCode} — product codes must match`
      );
      err.status = 422;
      throw err;
    }
    if (farContract.expirationDate <= nearContract.expirationDate) {
      const err = new Error(
        `Roll target contract must expire after the current contract (${nearContract.expirationDate})`
      );
      err.status = 422;
      throw err;
    }
  }

  const recordId = `FCR-${uuidv4()}`;
  const now = new Date().toISOString();
  const closePrice = (nearContract.currentBid + nearContract.currentAsk) / 2;

  const record = {
    recordId,
    accountId,
    action,
    futuresId,
    nearContractSymbol: nearContract.symbol,
    nearContractExpirationDate: nearContract.expirationDate,
    quantity,
    closePrice,
    closedValue: quantity * nearContract.contractSize * closePrice,
    commission: 2.25 * quantity, // typical per-contract futures commission
    status: 'COMPLETED',
    closedAt: now,
  };

  if (action === 'ROLL' && farContract) {
    const rollOpenPrice = (farContract.currentBid + farContract.currentAsk) / 2;
    const rollCost = rollOpenPrice - closePrice; // cost/credit of the roll (per unit)

    record.rollDetails = {
      rollToContractId,
      farContractSymbol: farContract.symbol,
      farContractExpirationDate: farContract.expirationDate,
      rollOpenPrice,
      rollCostPerContract: parseFloat(
        (rollCost * nearContract.contractSize).toFixed(2)
      ),
      totalRollCost: parseFloat(
        (rollCost * nearContract.contractSize * quantity).toFixed(2)
      ),
    };

    emitEvent('derivative.position_opened', {
      accountId,
      instrumentType: 'FUTURE',
      symbol: farContract.symbol,
      derivativeId: rollToContractId,
      side: 'LONG', // assumes same side as closed position
      quantity,
      openPrice: rollOpenPrice,
      openedAt: now,
    });
  }

  closeAndRollRecords.set(recordId, record);

  emitEvent('derivative.expired', {
    derivativeId: futuresId,
    accountId,
    symbol: nearContract.symbol,
    expirationDate: nearContract.expirationDate,
    settlementValue: record.closedValue,
    expiredAt: now,
  });

  return record;
}

/**
 * Get a close/roll record by ID.
 * @param {string} recordId
 */
async function getCloseRecord(recordId) {
  const record = closeAndRollRecords.get(recordId);
  if (!record) {
    const err = new Error(`Close/roll record not found: ${recordId}`);
    err.status = 404;
    throw err;
  }
  return record;
}

/**
 * List all close/roll records (optionally filter by accountId).
 * @param {string} [accountId]
 */
async function listCloseRecords(accountId) {
  const all = Array.from(closeAndRollRecords.values());
  if (accountId) {
    return all.filter((r) => r.accountId === accountId);
  }
  return all;
}

// ---------------------------------------------------------------------------
// Internal event emission stub
// ---------------------------------------------------------------------------
function emitEvent(topic, payload) {
  console.log(`[event:${topic}]`, JSON.stringify({ ...payload, _eventId: uuidv4() }));
}

module.exports = {
  getContract,
  listContracts,
  closeFutures,
  getCloseRecord,
  listCloseRecords,
};
