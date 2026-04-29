'use strict';

const { v4: uuidv4 } = require('uuid');

// ─── Configuration ────────────────────────────────────────────────────────────
const INITIAL_MARGIN_RATE = parseFloat(process.env.INITIAL_MARGIN_RATE || '0.50');
const MAINTENANCE_MARGIN_RATE = parseFloat(process.env.MAINTENANCE_MARGIN_RATE || '0.25');

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

/**
 * Simulated account state referenced for pre-trade margin checks.
 * In production this data would be fetched from account-service and
 * portfolio-service at request time.
 */
const accountSnapshots = {
  'acct-001': {
    accountId: 'acct-001',
    accountType: 'margin',
    cashBalance: 25000.0,
    marginDebitBalance: 15000.0,
    positions: [
      { symbol: 'AAPL', quantity: 100, currentPrice: 185.5 },
      { symbol: 'MSFT', quantity: 50, currentPrice: 415.2 },
      { symbol: 'TSLA', quantity: 30, currentPrice: 248.75 },
    ],
  },
  'acct-002': {
    accountId: 'acct-002',
    accountType: 'margin',
    cashBalance: 5000.0,
    marginDebitBalance: 28000.0,
    positions: [
      { symbol: 'GME', quantity: 200, currentPrice: 15.5 },
      { symbol: 'AMC', quantity: 500, currentPrice: 4.25 },
    ],
  },
};

/** Recent margin check audit log keyed by checkId */
const marginCheckLog = {};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAccountSnapshot(accountId) {
  if (!accountSnapshots[accountId]) {
    // Seed a minimal account for demo/test usage
    accountSnapshots[accountId] = {
      accountId,
      accountType: 'margin',
      cashBalance: 10000.0,
      marginDebitBalance: 0.0,
      positions: [],
    };
  }
  return accountSnapshots[accountId];
}

function computePortfolioMarketValue(positions) {
  return positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
}

function computeEquity(cashBalance, portfolioMarketValue, marginDebitBalance) {
  return cashBalance + portfolioMarketValue - marginDebitBalance;
}

function publishEvent(topic, payload) {
  console.log(
    JSON.stringify({
      eventId: uuidv4(),
      topic,
      publishedAt: new Date().toISOString(),
      ...payload,
    })
  );
}

// ─── Business Logic ───────────────────────────────────────────────────────────

/**
 * Perform a pre-trade margin requirement validation.
 *
 * @param {object} params
 * @param {string} params.accountId
 * @param {string} params.symbol
 * @param {'buy'|'sell'|'sell_short'|'buy_to_cover'} params.side
 * @param {number} params.quantity
 * @param {number} params.estimatedPrice
 * @param {'market'|'limit'|'stop'|'stop_limit'} params.orderType
 * @returns {Promise<object>}
 */
async function checkMargin({ accountId, symbol, side, quantity, estimatedPrice, orderType }) {
  const account = getAccountSnapshot(accountId);
  const portfolioMarketValue = computePortfolioMarketValue(account.positions);
  const equityValue = computeEquity(
    account.cashBalance,
    portfolioMarketValue,
    account.marginDebitBalance
  );

  const tradeValue = parseFloat((quantity * estimatedPrice).toFixed(2));
  const requiredMargin = parseFloat((tradeValue * INITIAL_MARGIN_RATE).toFixed(2));

  // Buying power = equity / initial margin rate for margin accounts
  const availableBuyingPower = parseFloat(
    (equityValue / INITIAL_MARGIN_RATE).toFixed(2)
  );

  const warnings = [];

  let marginSufficient = false;
  let postTradeEquityEstimate = equityValue;
  let postTradeMarginRatio = 0;
  let postTradePortfolioValue = portfolioMarketValue;

  if (side === 'buy') {
    // Buying increases portfolio value and margin debit
    postTradePortfolioValue = portfolioMarketValue + tradeValue;
    const postTradeDebitBalance = account.marginDebitBalance + (tradeValue - Math.min(tradeValue, account.cashBalance));
    postTradeEquityEstimate = computeEquity(
      account.cashBalance,
      postTradePortfolioValue,
      postTradeDebitBalance
    );
    marginSufficient = tradeValue <= availableBuyingPower;

    if (!marginSufficient) {
      warnings.push({
        code: 'INSUFFICIENT_BUYING_POWER',
        message: `Trade requires $${tradeValue.toFixed(2)} in buying power but only $${availableBuyingPower.toFixed(2)} is available.`,
      });
    }

    const postTradeMaintenanceReq = postTradePortfolioValue * MAINTENANCE_MARGIN_RATE;
    if (postTradeEquityEstimate < postTradeMaintenanceReq) {
      warnings.push({
        code: 'MAINTENANCE_MARGIN_AT_RISK',
        message: 'Post-trade equity may fall below maintenance margin requirements.',
      });
    }
  } else if (side === 'sell') {
    // Selling a long position reduces portfolio value and frees up buying power
    const existingPosition = account.positions.find((p) => p.symbol === symbol);
    if (!existingPosition) {
      const err = new Error(`No existing position found for symbol ${symbol} to sell`);
      err.status = 422;
      throw err;
    }
    if (existingPosition.quantity < quantity) {
      warnings.push({
        code: 'INSUFFICIENT_SHARES',
        message: `Account holds ${existingPosition.quantity} shares of ${symbol} but order requests ${quantity}.`,
      });
    }
    postTradePortfolioValue = Math.max(0, portfolioMarketValue - tradeValue);
    postTradeEquityEstimate = computeEquity(
      account.cashBalance + tradeValue,
      postTradePortfolioValue,
      account.marginDebitBalance
    );
    marginSufficient = true; // Selling always reduces margin usage
  } else if (side === 'sell_short') {
    // Short selling requires initial margin on the short side
    marginSufficient = requiredMargin <= equityValue;
    if (!marginSufficient) {
      warnings.push({
        code: 'INSUFFICIENT_MARGIN_FOR_SHORT',
        message: `Short sale requires $${requiredMargin.toFixed(2)} in margin but equity is $${equityValue.toFixed(2)}.`,
      });
    }
    postTradeEquityEstimate = equityValue - requiredMargin;
  } else if (side === 'buy_to_cover') {
    // Covering a short position
    marginSufficient = tradeValue <= availableBuyingPower;
    if (!marginSufficient) {
      warnings.push({
        code: 'INSUFFICIENT_BUYING_POWER_TO_COVER',
        message: `Buy-to-cover requires $${tradeValue.toFixed(2)} but available buying power is $${availableBuyingPower.toFixed(2)}.`,
      });
    }
    postTradeEquityEstimate = equityValue + Math.max(0, (estimatedPrice * 0.95 - estimatedPrice) * quantity); // simplified P&L
  }

  postTradeMarginRatio =
    postTradePortfolioValue > 0
      ? parseFloat((postTradeEquityEstimate / postTradePortfolioValue).toFixed(4))
      : 0;

  if (equityValue / Math.max(portfolioMarketValue, 1) < MAINTENANCE_MARGIN_RATE * 1.1) {
    warnings.push({
      code: 'NEAR_MAINTENANCE_MARGIN',
      message: 'Account equity is within 10% of maintenance margin threshold.',
    });
  }

  if (orderType === 'market' && tradeValue > 50000) {
    warnings.push({
      code: 'LARGE_MARKET_ORDER',
      message: 'Large market orders may experience significant slippage affecting margin calculations.',
    });
  }

  const approved = marginSufficient && warnings.filter((w) => w.code !== 'NEAR_MAINTENANCE_MARGIN' && w.code !== 'LARGE_MARKET_ORDER').length === 0;
  const checkedAt = new Date().toISOString();

  const checkId = uuidv4();
  const result = {
    checkId,
    approved,
    accountId,
    symbol,
    side,
    quantity,
    estimatedPrice,
    orderType,
    tradeValue,
    requiredMargin,
    availableBuyingPower,
    marginSufficient,
    postTradeEquityEstimate: parseFloat(postTradeEquityEstimate.toFixed(2)),
    postTradeMarginRatio,
    warnings,
    checkedAt,
  };

  marginCheckLog[checkId] = result;

  if (!approved) {
    publishEvent('margin.buying_power_updated', {
      accountId,
      previousBuyingPower: availableBuyingPower,
      newBuyingPower: availableBuyingPower,
      changeAmount: 0,
      changeReason: 'pre-trade margin check — trade blocked',
      updatedAt: checkedAt,
    });
  }

  return result;
}

module.exports = {
  checkMargin,
};
