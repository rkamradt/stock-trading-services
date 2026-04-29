'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store for brokerage accounts.
 * Key: accountId (string)  Value: Account object
 */
const accountStore = new Map();

/**
 * In-memory store for account transactions (deposits / withdrawals).
 * Key: transactionId  Value: Transaction object
 */
const transactionStore = new Map();

// ─── Seed data ────────────────────────────────────────────────────────────────

const _seedAccountId = 'acc-0001-seed-0000-000000000001';
const _seedCustomerId = 'cus-0001-seed-0000-000000000001';

accountStore.set(_seedAccountId, {
  accountId: _seedAccountId,
  customerId: _seedCustomerId,
  accountType: 'INDIVIDUAL',
  status: 'ACTIVE',
  currency: 'USD',
  cashBalance: 25000.0,
  reservedCash: 0.0,
  availableCash: 25000.0,
  settings: {
    tradingPermissions: ['EQUITIES', 'OPTIONS'],
    marginEnabled: false,
    optionsLevel: 1,
    dayTradingEnabled: false,
  },
  createdAt: new Date('2024-01-15T09:00:00.000Z').toISOString(),
  updatedAt: new Date('2024-01-15T09:00:00.000Z').toISOString(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Publish a domain event to the event bus (fire-and-forget, best effort).
 * Replace the body with a real broker client as needed.
 */
async function publishEvent(topic, payload) {
  console.log(`[account-service] EVENT ${topic}:`, JSON.stringify(payload));
  // TODO: replace with real message broker client
}

function notFound(accountId) {
  const err = new Error(`Account '${accountId}' not found`);
  err.status = 404;
  return err;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Create a new brokerage account for a customer.
 */
async function createAccount({ customerId, accountType, currency = 'USD' }) {
  const accountId = uuidv4();
  const now = new Date().toISOString();

  const account = {
    accountId,
    customerId,
    accountType,
    status: 'PENDING',
    currency,
    cashBalance: 0.0,
    reservedCash: 0.0,
    availableCash: 0.0,
    settings: {
      tradingPermissions: ['EQUITIES'],
      marginEnabled: false,
      optionsLevel: 0,
      dayTradingEnabled: false,
    },
    createdAt: now,
    updatedAt: now,
  };

  accountStore.set(accountId, account);

  await publishEvent('account.created', {
    accountId,
    customerId,
    accountType,
    status: account.status,
    currency,
    createdAt: now,
  });

  return account;
}

/**
 * Retrieve a single account by its ID.
 */
async function getAccountById(accountId) {
  const account = accountStore.get(accountId);
  if (!account) throw notFound(accountId);
  return account;
}

/**
 * Return all accounts owned by a specific customer.
 */
async function getAccountsByCustomerId(customerId) {
  return [...accountStore.values()].filter((a) => a.customerId === customerId);
}

/**
 * Update trading permissions and settings for an account.
 */
async function updateAccountSettings(accountId, settings) {
  const account = accountStore.get(accountId);
  if (!account) throw notFound(accountId);

  const previousStatus = account.status;

  // Merge settings selectively
  const updatedSettings = { ...account.settings };
  if (Array.isArray(settings.tradingPermissions)) {
    updatedSettings.tradingPermissions = settings.tradingPermissions;
  }
  if (typeof settings.marginEnabled === 'boolean') {
    updatedSettings.marginEnabled = settings.marginEnabled;
    // Upgrading to margin account changes the accountType
    if (settings.marginEnabled && account.accountType === 'INDIVIDUAL') {
      account.accountType = 'MARGIN';
    }
  }
  if (typeof settings.optionsLevel === 'number') {
    updatedSettings.optionsLevel = settings.optionsLevel;
    // Enable OPTIONS permission automatically if level > 0
    if (settings.optionsLevel > 0 && !updatedSettings.tradingPermissions.includes('OPTIONS')) {
      updatedSettings.tradingPermissions.push('OPTIONS');
    }
  }
  if (typeof settings.dayTradingEnabled === 'boolean') {
    updatedSettings.dayTradingEnabled = settings.dayTradingEnabled;
  }

  account.settings = updatedSettings;
  account.updatedAt = new Date().toISOString();
  accountStore.set(accountId, account);

  if (account.status !== previousStatus) {
    await publishEvent('account.status_changed', {
      accountId,
      previousStatus,
      newStatus: account.status,
      reason: 'Settings update',
      changedAt: account.updatedAt,
    });
  }

  return account;
}

/**
 * Record a cash deposit to the account and update the balance.
 */
async function recordDeposit(accountId, { amount, currency, reference }) {
  const account = accountStore.get(accountId);
  if (!account) throw notFound(accountId);

  if (account.status === 'CLOSED' || account.status === 'SUSPENDED') {
    const err = new Error(`Cannot deposit into an account with status '${account.status}'`);
    err.status = 422;
    throw err;
  }

  const transactionId = uuidv4();
  const now = new Date().toISOString();
  const parsedAmount = parseFloat(amount);

  const balanceBefore = account.cashBalance;
  account.cashBalance = parseFloat((balanceBefore + parsedAmount).toFixed(2));
  account.availableCash = parseFloat((account.cashBalance - account.reservedCash).toFixed(2));

  // Activate a PENDING account on first deposit
  const previousStatus = account.status;
  if (account.status === 'PENDING') {
    account.status = 'ACTIVE';
  }

  account.updatedAt = now;
  accountStore.set(accountId, account);

  const transaction = {
    transactionId,
    accountId,
    type: 'DEPOSIT',
    amount: parsedAmount,
    currency: currency || account.currency,
    reference: reference || null,
    balanceBefore,
    balanceAfter: account.cashBalance,
    createdAt: now,
  };
  transactionStore.set(transactionId, transaction);

  await publishEvent('account.balance_updated', {
    accountId,
    transactionId,
    transactionType: 'DEPOSIT',
    previousBalance: balanceBefore,
    newBalance: account.cashBalance,
    changeAmount: parsedAmount,
    currency: transaction.currency,
    timestamp: now,
  });

  if (account.status !== previousStatus) {
    await publishEvent('account.status_changed', {
      accountId,
      previousStatus,
      newStatus: account.status,
      reason: 'First deposit — account activated',
      changedAt: now,
    });
  }

  return { account, transaction };
}

/**
 * Process a cash withdrawal from the account.
 */
async function recordWithdrawal(accountId, { amount, currency, reference }) {
  const account = accountStore.get(accountId);
  if (!account) throw notFound(accountId);

  if (account.status !== 'ACTIVE') {
    const err = new Error(`Cannot withdraw from an account with status '${account.status}'`);
    err.status = 422;
    throw err;
  }

  const parsedAmount = parseFloat(amount);
  if (parsedAmount > account.availableCash) {
    const err = new Error(
      `Insufficient available cash. Requested: ${parsedAmount}, Available: ${account.availableCash}`
    );
    err.status = 422;
    throw err;
  }

  const transactionId = uuidv4();
  const now = new Date().toISOString();

  const balanceBefore = account.cashBalance;
  account.cashBalance = parseFloat((balanceBefore - parsedAmount).toFixed(2));
  account.availableCash = parseFloat((account.cashBalance - account.reservedCash).toFixed(2));
  account.updatedAt = now;
  accountStore.set(accountId, account);

  const transaction = {
    transactionId,
    accountId,
    type: 'WITHDRAWAL',
    amount: parsedAmount,
    currency: currency || account.currency,
    reference: reference || null,
    balanceBefore,
    balanceAfter: account.cashBalance,
    createdAt: now,
  };
  transactionStore.set(transactionId, transaction);

  await publishEvent('account.balance_updated', {
    accountId,
    transactionId,
    transactionType: 'WITHDRAWAL',
    previousBalance: balanceBefore,
    newBalance: account.cashBalance,
    changeAmount: -parsedAmount,
    currency: transaction.currency,
    timestamp: now,
  });

  return { account, transaction };
}

/**
 * Calculate total account equity including an estimated positions value.
 * PortfolioService is the authoritative source for positions; this provides
 * a best-effort calculation based on cash balance only when that service
 * is unavailable.
 */
async function getAccountEquity(accountId) {
  const account = accountStore.get(accountId);
  if (!account) throw notFound(accountId);

  // Attempt to retrieve positions value from PortfolioService
  let positionsValue = 0.0;
  const portfolioServiceUrl = process.env.PORTFOLIO_SERVICE_URL;

  if (portfolioServiceUrl) {
    try {
      const res = await fetch(`${portfolioServiceUrl}/accounts/${accountId}/pnl`);
      if (res.ok) {
        const pnl = await res.json();
        positionsValue = typeof pnl.marketValue === 'number' ? pnl.marketValue : 0.0;
      }
    } catch (fetchErr) {
      console.warn(
        `[account-service] Could not reach portfolio-service for equity calculation: ${fetchErr.message}`
      );
    }
  }

  const totalEquity = parseFloat((account.cashBalance + positionsValue).toFixed(2));

  return {
    accountId,
    cashBalance: account.cashBalance,
    reservedCash: account.reservedCash,
    availableCash: account.availableCash,
    positionsValue,
    totalEquity,
    currency: account.currency,
    calculatedAt: new Date().toISOString(),
  };
}

module.exports = {
  createAccount,
  getAccountById,
  getAccountsByCustomerId,
  updateAccountSettings,
  recordDeposit,
  recordWithdrawal,
  getAccountEquity,
};
