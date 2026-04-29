'use strict';

const { v4: uuidv4 } = require('uuid');

// ─── Configuration ────────────────────────────────────────────────────────────
const INITIAL_MARGIN_RATE = parseFloat(process.env.INITIAL_MARGIN_RATE || '0.50');
const MAINTENANCE_MARGIN_RATE = parseFloat(process.env.MAINTENANCE_MARGIN_RATE || '0.25');
const ANNUAL_INTEREST_RATE = parseFloat(process.env.MARGIN_INTEREST_RATE || '0.085');
const DAYS_IN_YEAR = 360; // broker convention

// ─── In-Memory Stores ─────────────────────────────────────────────────────────

/**
 * Simulated account margin data keyed by accountId.
 * In production this would be read from account-service and portfolio-service.
 */
const marginAccounts = {
  'acct-001': {
    accountId: 'acct-001',
    accountType: 'margin',
    cashBalance: 25000.0,
    marginDebitBalance: 15000.0,
    accruedInterest: 312.5,
    interestPeriodStart: '2024-01-01',
    positions: [
      { symbol: 'AAPL', quantity: 100, currentPrice: 185.5, haircut: 0.15 },
      { symbol: 'MSFT', quantity: 50, currentPrice: 415.2, haircut: 0.15 },
      { symbol: 'TSLA', quantity: 30, currentPrice: 248.75, haircut: 0.30 },
    ],
  },
  'acct-002': {
    accountId: 'acct-002',
    accountType: 'margin',
    cashBalance: 5000.0,
    marginDebitBalance: 28000.0,
    accruedInterest: 980.0,
    interestPeriodStart: '2024-01-01',
    positions: [
      { symbol: 'GME', quantity: 200, currentPrice: 15.5, haircut: 0.50 },
      { symbol: 'AMC', quantity: 500, currentPrice: 4.25, haircut: 0.50 },
    ],
  },
};

/** Active margin calls keyed by accountId */
const marginCalls = {};

/** Liquidation records keyed by liquidationId */
const liquidations = {};

/** Interest charge history keyed by accountId */
const interestHistory = {
  'acct-001': [
    {
      chargeId: 'int-001',
      date: '2024-01-31',
      debitBalance: 15000.0,
      dailyRate: ANNUAL_INTEREST_RATE / DAYS_IN_YEAR,
      amount: parseFloat(((15000.0 * ANNUAL_INTEREST_RATE) / DAYS_IN_YEAR).toFixed(4)),
      description: 'Daily margin interest',
    },
  ],
  'acct-002': [
    {
      chargeId: 'int-002',
      date: '2024-01-31',
      debitBalance: 28000.0,
      dailyRate: ANNUAL_INTEREST_RATE / DAYS_IN_YEAR,
      amount: parseFloat(((28000.0 * ANNUAL_INTEREST_RATE) / DAYS_IN_YEAR).toFixed(4)),
      description: 'Daily margin interest',
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAccountOrThrow(accountId) {
  const account = marginAccounts[accountId];
  if (!account) {
    // Seed a minimal margin account for unknown IDs to support demo/test usage
    marginAccounts[accountId] = {
      accountId,
      accountType: 'margin',
      cashBalance: 10000.0,
      marginDebitBalance: 0.0,
      accruedInterest: 0.0,
      interestPeriodStart: new Date().toISOString().slice(0, 10),
      positions: [],
    };
  }
  return marginAccounts[accountId];
}

function computePortfolioMarketValue(positions) {
  return positions.reduce((sum, p) => sum + p.quantity * p.currentPrice, 0);
}

function computeEquity(cashBalance, portfolioMarketValue, marginDebitBalance) {
  return cashBalance + portfolioMarketValue - marginDebitBalance;
}

function publishEvent(topic, payload) {
  // In production, publish to a message broker (Kafka, RabbitMQ, etc.)
  // For now, emit to stdout as a structured log.
  console.log(
    JSON.stringify({
      eventId: uuidv4(),
      topic,
      publishedAt: new Date().toISOString(),
      ...payload,
    })
  );
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Calculate available buying power for margin trades.
 */
async function getBuyingPower(accountId) {
  const account = getAccountOrThrow(accountId);
  const portfolioMarketValue = computePortfolioMarketValue(account.positions);
  const equityValue = computeEquity(
    account.cashBalance,
    portfolioMarketValue,
    account.marginDebitBalance
  );

  // Reg T buying power: equity above initial margin requirement × margin multiplier
  // Available buying power = (equity - initial margin requirement on existing positions) / initial margin rate
  const initialMarginOnPositions = portfolioMarketValue * INITIAL_MARGIN_RATE;
  const excessEquity = Math.max(0, equityValue - initialMarginOnPositions);
  // Buying power = excess equity / initial margin rate (2× leverage for Reg T margin accounts)
  const marginMultiplier = 1 / INITIAL_MARGIN_RATE; // e.g. 2 for 50% Reg T
  const availableBuyingPower = excessEquity * marginMultiplier + account.cashBalance;

  const result = {
    accountId,
    cashBalance: account.cashBalance,
    portfolioMarketValue: parseFloat(portfolioMarketValue.toFixed(2)),
    marginDebitBalance: account.marginDebitBalance,
    equityValue: parseFloat(equityValue.toFixed(2)),
    initialMarginRequirement: parseFloat(initialMarginOnPositions.toFixed(2)),
    availableBuyingPower: parseFloat(Math.max(0, availableBuyingPower).toFixed(2)),
    excessEquity: parseFloat(excessEquity.toFixed(2)),
    marginMultiplier,
    accountType: account.accountType,
    calculatedAt: new Date().toISOString(),
  };

  publishEvent('margin.buying_power_updated', {
    accountId,
    previousBuyingPower: result.availableBuyingPower,
    newBuyingPower: result.availableBuyingPower,
    changeAmount: 0,
    changeReason: 'on-demand calculation',
    updatedAt: result.calculatedAt,
  });

  return result;
}

/**
 * Get current margin requirements and maintenance levels.
 */
async function getMarginRequirements(accountId) {
  const account = getAccountOrThrow(accountId);
  const portfolioMarketValue = computePortfolioMarketValue(account.positions);
  const equityValue = computeEquity(
    account.cashBalance,
    portfolioMarketValue,
    account.marginDebitBalance
  );

  const initialMarginRequirement = parseFloat(
    (portfolioMarketValue * INITIAL_MARGIN_RATE).toFixed(2)
  );
  const maintenanceMarginRequirement = parseFloat(
    (portfolioMarketValue * MAINTENANCE_MARGIN_RATE).toFixed(2)
  );
  const currentMarginRatio =
    portfolioMarketValue > 0
      ? parseFloat((equityValue / portfolioMarketValue).toFixed(4))
      : 0;
  const isInMarginCall = equityValue < maintenanceMarginRequirement;
  const deficiencyAmount = isInMarginCall
    ? parseFloat((maintenanceMarginRequirement - equityValue).toFixed(2))
    : 0;

  const positionDetails = account.positions.map((p) => ({
    symbol: p.symbol,
    quantity: p.quantity,
    currentPrice: p.currentPrice,
    marketValue: parseFloat((p.quantity * p.currentPrice).toFixed(2)),
    initialMarginRequired: parseFloat(
      (p.quantity * p.currentPrice * INITIAL_MARGIN_RATE).toFixed(2)
    ),
    maintenanceMarginRequired: parseFloat(
      (p.quantity * p.currentPrice * MAINTENANCE_MARGIN_RATE).toFixed(2)
    ),
  }));

  return {
    accountId,
    portfolioMarketValue: parseFloat(portfolioMarketValue.toFixed(2)),
    marginDebitBalance: account.marginDebitBalance,
    equityValue: parseFloat(equityValue.toFixed(2)),
    initialMarginRequirement,
    maintenanceMarginRequirement,
    currentMarginRatio,
    initialMarginRate: INITIAL_MARGIN_RATE,
    maintenanceMarginRate: MAINTENANCE_MARGIN_RATE,
    isInMarginCall,
    deficiencyAmount,
    positions: positionDetails,
    calculatedAt: new Date().toISOString(),
  };
}

/**
 * Check current margin call status and deficiency amount.
 */
async function getMarginCalls(accountId) {
  const account = getAccountOrThrow(accountId);
  const portfolioMarketValue = computePortfolioMarketValue(account.positions);
  const equityValue = computeEquity(
    account.cashBalance,
    portfolioMarketValue,
    account.marginDebitBalance
  );
  const maintenanceMarginRequirement = parseFloat(
    (portfolioMarketValue * MAINTENANCE_MARGIN_RATE).toFixed(2)
  );
  const isInMarginCall = equityValue < maintenanceMarginRequirement;
  const deficiencyAmount = isInMarginCall
    ? parseFloat((maintenanceMarginRequirement - equityValue).toFixed(2))
    : 0;

  const now = new Date().toISOString();

  // Check if there's already an active margin call record
  let activeCall = marginCalls[accountId];

  if (isInMarginCall && !activeCall) {
    // Issue a new margin call
    const callId = uuidv4();
    const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(); // T+3
    activeCall = {
      marginCallId: callId,
      callType: 'maintenance',
      deficiencyAmount,
      equityValue: parseFloat(equityValue.toFixed(2)),
      maintenanceMarginRequirement,
      marginCallIssuedAt: now,
      dueDate,
      status: 'open',
    };
    marginCalls[accountId] = activeCall;

    publishEvent('margin.call_triggered', {
      accountId,
      equityValue: parseFloat(equityValue.toFixed(2)),
      maintenanceMarginRequirement,
      deficiencyAmount,
      callType: 'maintenance',
      marginCallId: callId,
      issuedAt: now,
    });
  } else if (!isInMarginCall && activeCall && activeCall.status === 'open') {
    // Margin call resolved
    activeCall.status = 'satisfied';
    delete marginCalls[accountId];
  }

  return {
    accountId,
    isInMarginCall,
    marginCallId: activeCall ? activeCall.marginCallId : null,
    callType: activeCall ? activeCall.callType : null,
    deficiencyAmount,
    equityValue: parseFloat(equityValue.toFixed(2)),
    maintenanceMarginRequirement,
    marginCallIssuedAt: activeCall ? activeCall.marginCallIssuedAt : null,
    dueDate: activeCall ? activeCall.dueDate : null,
    status: activeCall ? activeCall.status : 'none',
    calculatedAt: now,
  };
}

/**
 * Calculate margin interest owed on borrowed funds.
 */
async function getInterest(accountId) {
  const account = getAccountOrThrow(accountId);
  const now = new Date();
  const dailyInterestRate = ANNUAL_INTEREST_RATE / DAYS_IN_YEAR;
  const accruedInterestToday = parseFloat(
    (account.marginDebitBalance * dailyInterestRate).toFixed(4)
  );
  const charges = interestHistory[accountId] || [];
  const totalUnpaidInterest = parseFloat(
    (
      account.accruedInterest +
      charges.reduce((sum, c) => sum + c.amount, 0)
    ).toFixed(4)
  );

  publishEvent('margin.interest_accrued', {
    accountId,
    marginDebitBalance: account.marginDebitBalance,
    dailyInterestAmount: accruedInterestToday,
    annualInterestRate: ANNUAL_INTEREST_RATE,
    accruedDate: now.toISOString().slice(0, 10),
  });

  return {
    accountId,
    marginDebitBalance: account.marginDebitBalance,
    annualInterestRate: ANNUAL_INTEREST_RATE,
    dailyInterestRate: parseFloat(dailyInterestRate.toFixed(8)),
    accruedInterestToday,
    totalUnpaidInterest,
    interestPeriodStart: account.interestPeriodStart,
    interestPeriodEnd: now.toISOString().slice(0, 10),
    interestCharges: charges,
    calculatedAt: now.toISOString(),
  };
}

/**
 * Get collateral values and haircut calculations.
 */
async function getCollateral(accountId) {
  const account = getAccountOrThrow(accountId);
  const now = new Date().toISOString();

  const positionCollateral = account.positions.map((p) => {
    const marketValue = parseFloat((p.quantity * p.currentPrice).toFixed(2));
    const haircutAmount = parseFloat((marketValue * p.haircut).toFixed(2));
    const collateralValue = parseFloat((marketValue - haircutAmount).toFixed(2));
    return {
      symbol: p.symbol,
      quantity: p.quantity,
      currentPrice: p.currentPrice,
      marketValue,
      haircutRate: p.haircut,
      haircutAmount,
      collateralValue,
    };
  });

  const totalMarketValue = parseFloat(
    positionCollateral.reduce((sum, p) => sum + p.marketValue, 0).toFixed(2)
  );
  const totalCollateralValue = parseFloat(
    positionCollateral.reduce((sum, p) => sum + p.collateralValue, 0).toFixed(2)
  );
  const weightedHaircutRate =
    totalMarketValue > 0
      ? parseFloat(((totalMarketValue - totalCollateralValue) / totalMarketValue).toFixed(4))
      : 0;
  const cashCollateral = account.cashBalance;
  const totalEffectiveCollateral = parseFloat(
    (totalCollateralValue + cashCollateral).toFixed(2)
  );

  return {
    accountId,
    positions: positionCollateral,
    totalMarketValue,
    totalCollateralValue,
    weightedHaircutRate,
    cashCollateral,
    totalEffectiveCollateral,
    calculatedAt: now,
  };
}

/**
 * Trigger liquidation process for margin calls.
 */
async function triggerLiquidation(accountId, body) {
  const { reason, liquidationTargetAmount, authorizedBy } = body;
  const account = getAccountOrThrow(accountId);
  const portfolioMarketValue = computePortfolioMarketValue(account.positions);
  const equityValue = computeEquity(
    account.cashBalance,
    portfolioMarketValue,
    account.marginDebitBalance
  );
  const maintenanceMarginRequirement = parseFloat(
    (portfolioMarketValue * MAINTENANCE_MARGIN_RATE).toFixed(2)
  );
  const deficiencyAmount = parseFloat(
    Math.max(0, maintenanceMarginRequirement - equityValue).toFixed(2)
  );

  // Determine how much to liquidate: provided amount or full deficiency + buffer
  const targetAmount =
    liquidationTargetAmount != null
      ? parseFloat(liquidationTargetAmount)
      : parseFloat((deficiencyAmount * 1.1).toFixed(2)); // 10% buffer

  // Select positions to liquidate — highest haircut (most volatile) first
  const sortedPositions = [...account.positions].sort((a, b) => b.haircut - a.haircut);
  const positionsToLiquidate = [];
  let accumulatedProceeds = 0;

  for (const pos of sortedPositions) {
    if (accumulatedProceeds >= targetAmount) break;
    const positionValue = pos.quantity * pos.currentPrice;
    const needed = targetAmount - accumulatedProceeds;
    const sharesToSell = Math.min(
      pos.quantity,
      Math.ceil(needed / pos.currentPrice)
    );
    const estimatedProceeds = parseFloat((sharesToSell * pos.currentPrice).toFixed(2));
    positionsToLiquidate.push({
      symbol: pos.symbol,
      sharesToSell,
      estimatedPricePerShare: pos.currentPrice,
      estimatedProceeds,
    });
    accumulatedProceeds += estimatedProceeds;
  }

  const totalEstimatedProceeds = parseFloat(
    positionsToLiquidate.reduce((s, p) => s + p.estimatedProceeds, 0).toFixed(2)
  );

  const liquidationId = uuidv4();
  const now = new Date().toISOString();
  const expectedCompletionAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // T+1h

  const record = {
    liquidationId,
    accountId,
    status: 'initiated',
    reason,
    authorizedBy,
    deficiencyAmount,
    liquidationTargetAmount: targetAmount,
    positionsToLiquidate,
    estimatedProceeds: totalEstimatedProceeds,
    initiatedAt: now,
    expectedCompletionAt,
  };

  liquidations[liquidationId] = record;

  publishEvent('margin.liquidation_required', {
    accountId,
    liquidationId,
    deficiencyAmount,
    liquidationTargetAmount: targetAmount,
    positionsToLiquidate,
    triggeredAt: now,
  });

  return record;
}

module.exports = {
  getBuyingPower,
  getMarginRequirements,
  getMarginCalls,
  getInterest,
  getCollateral,
  triggerLiquidation,
};
