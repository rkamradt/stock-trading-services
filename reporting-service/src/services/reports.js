'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory stores for report and schedule records.
 */
const reportStore = new Map();
const scheduleStore = new Map();

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
    // Non-fatal — events are best-effort
  }
}

/**
 * Compute a placeholder download URL for a generated report.
 */
function buildDownloadUrl(reportId, format) {
  return `/reports/downloads/${reportId}.${(format || 'PDF').toLowerCase()}`;
}

/**
 * Calculate the next run timestamp for a scheduled report based on frequency.
 */
function calculateNextRunAt(frequency, fromDate) {
  const base = fromDate ? new Date(fromDate) : new Date();
  switch (frequency) {
    case 'DAILY':
      base.setDate(base.getDate() + 1);
      break;
    case 'WEEKLY':
      base.setDate(base.getDate() + 7);
      break;
    case 'MONTHLY':
      base.setMonth(base.getMonth() + 1);
      break;
    case 'QUARTERLY':
      base.setMonth(base.getMonth() + 3);
      break;
    case 'ANNUALLY':
      base.setFullYear(base.getFullYear() + 1);
      break;
    default:
      base.setDate(base.getDate() + 1);
  }
  return base.toISOString();
}

// ---------------------------------------------------------------------------
// Statement generation
// ---------------------------------------------------------------------------

/**
 * Generate an account statement for the given date range.
 *
 * @param {{ accountId: string, startDate: string, endDate: string, format?: string }} params
 * @returns {Promise<object>}
 */
async function generateStatement({ accountId, startDate, endDate, format = 'PDF' }) {
  const reportId = uuidv4();
  const generatedAt = new Date().toISOString();

  // Simulate aggregated statement data
  const openingBalance = parseFloat((Math.random() * 50000 + 10000).toFixed(2));
  const depositsTotal = parseFloat((Math.random() * 5000).toFixed(2));
  const withdrawalsTotal = parseFloat((Math.random() * 2000).toFixed(2));
  const tradePnl = parseFloat(((Math.random() - 0.45) * 8000).toFixed(2));
  const dividendsReceived = parseFloat((Math.random() * 500).toFixed(2));
  const feesCharged = parseFloat((Math.random() * 150).toFixed(2));
  const closingBalance = parseFloat(
    (openingBalance + depositsTotal - withdrawalsTotal + tradePnl + dividendsReceived - feesCharged).toFixed(2)
  );

  const report = {
    reportId,
    reportType: 'STATEMENT',
    accountId,
    startDate,
    endDate,
    format,
    status: 'GENERATED',
    generatedAt,
    downloadUrl: buildDownloadUrl(reportId, format),
    summary: {
      openingBalance,
      closingBalance,
      depositsTotal,
      withdrawalsTotal,
      tradePnl,
      dividendsReceived,
      feesCharged,
      netChange: parseFloat((closingBalance - openingBalance).toFixed(2)),
    },
    transactionCount: Math.floor(Math.random() * 50) + 1,
    currency: 'USD',
  };

  reportStore.set(reportId, report);

  await publishEvent('report.generated', {
    reportId,
    reportType: 'STATEMENT',
    accountId,
    generatedAt,
    format,
    sizeBytes: Math.floor(Math.random() * 200000) + 50000,
  });

  await publishEvent('statement.published', {
    reportId,
    accountId,
    statementPeriod: `${startDate} to ${endDate}`,
    startDate,
    endDate,
    publishedAt: generatedAt,
  });

  return report;
}

// ---------------------------------------------------------------------------
// Trade confirmation report
// ---------------------------------------------------------------------------

/**
 * Generate trade confirmation reports for executed orders.
 *
 * @param {{ accountId: string, tradeIds?: string[], startDate?: string, endDate?: string, format?: string }} params
 * @returns {Promise<object>}
 */
async function generateTradeConfirmations({ accountId, tradeIds, startDate, endDate, format = 'PDF' }) {
  const reportId = uuidv4();
  const generatedAt = new Date().toISOString();

  // Simulate trade confirmation records
  const resolvedTradeIds = tradeIds && tradeIds.length > 0
    ? tradeIds
    : Array.from({ length: Math.floor(Math.random() * 10) + 1 }, () => uuidv4());

  const confirmations = resolvedTradeIds.map((tradeId) => {
    const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
    const symbols = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM'];
    const symbol = symbols[Math.floor(Math.random() * symbols.length)];
    const quantity = Math.floor(Math.random() * 500) + 1;
    const executionPrice = parseFloat((Math.random() * 400 + 50).toFixed(2));
    const grossAmount = parseFloat((quantity * executionPrice).toFixed(2));
    const commission = parseFloat((grossAmount * 0.001).toFixed(2));
    const secFee = parseFloat((grossAmount * 0.0000229).toFixed(4));
    const netAmount = side === 'BUY'
      ? parseFloat((grossAmount + commission + secFee).toFixed(2))
      : parseFloat((grossAmount - commission - secFee).toFixed(2));

    return {
      tradeId,
      accountId,
      symbol,
      side,
      quantity,
      executionPrice,
      grossAmount,
      commission,
      secFee,
      netAmount,
      currency: 'USD',
      settlementDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      executedAt: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
      venue: 'NYSE',
      orderType: 'MARKET',
      confirmationNumber: `CONF-${tradeId.substring(0, 8).toUpperCase()}`,
    };
  });

  const report = {
    reportId,
    reportType: 'TRADE_CONFIRMATION',
    accountId,
    tradeCount: confirmations.length,
    startDate: startDate || null,
    endDate: endDate || null,
    format,
    status: 'GENERATED',
    generatedAt,
    downloadUrl: buildDownloadUrl(reportId, format),
    confirmations,
  };

  reportStore.set(reportId, report);

  await publishEvent('report.generated', {
    reportId,
    reportType: 'TRADE_CONFIRMATION',
    accountId,
    generatedAt,
    format,
    sizeBytes: Math.floor(Math.random() * 100000) + 20000,
  });

  // Emit confirmation.sent for each trade
  for (const conf of confirmations) {
    await publishEvent('confirmation.sent', {
      reportId,
      accountId,
      tradeId: conf.tradeId,
      confirmedAt: generatedAt,
      deliveryChannel: 'SECURE_PORTAL',
    });
  }

  return report;
}

// ---------------------------------------------------------------------------
// Margin utilization report
// ---------------------------------------------------------------------------

/**
 * Generate a margin utilization report for the given date range.
 *
 * @param {{ accountId: string, startDate: string, endDate: string, format?: string }} params
 * @returns {Promise<object>}
 */
async function generateMarginUtilizationReport({ accountId, startDate, endDate, format = 'PDF' }) {
  const reportId = uuidv4();
  const generatedAt = new Date().toISOString();

  const totalEquity = parseFloat((Math.random() * 100000 + 20000).toFixed(2));
  const marginBorrowed = parseFloat((Math.random() * totalEquity * 0.5).toFixed(2));
  const buyingPower = parseFloat((totalEquity * 2 - marginBorrowed).toFixed(2));
  const maintenanceRequirement = parseFloat((marginBorrowed * 0.3).toFixed(2));
  const averageUtilization = parseFloat((Math.random() * 60 + 10).toFixed(2));
  const peakUtilization = parseFloat((averageUtilization + Math.random() * 20).toFixed(2));
  const marginCallCount = Math.floor(Math.random() * 3);
  const totalInterestAccrued = parseFloat((marginBorrowed * 0.065 / 365 * 30).toFixed(2));

  const dailyUtilizationSeries = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dailyUtilizationSeries.push({
      date: d.toISOString().split('T')[0],
      marginBorrowed: parseFloat((marginBorrowed * (0.8 + Math.random() * 0.4)).toFixed(2)),
      buyingPowerUsedPercent: parseFloat((averageUtilization * (0.8 + Math.random() * 0.4)).toFixed(2)),
      dailyInterest: parseFloat((totalInterestAccrued / 30).toFixed(4)),
    });
  }

  const report = {
    reportId,
    reportType: 'MARGIN_UTILIZATION',
    accountId,
    startDate,
    endDate,
    format,
    status: 'GENERATED',
    generatedAt,
    downloadUrl: buildDownloadUrl(reportId, format),
    summary: {
      totalEquity,
      marginBorrowed,
      buyingPower,
      maintenanceRequirement,
      averageUtilization,
      peakUtilization,
      marginCallCount,
      totalInterestAccrued,
      currency: 'USD',
    },
    dailyUtilizationSeries,
  };

  reportStore.set(reportId, report);

  await publishEvent('report.generated', {
    reportId,
    reportType: 'MARGIN_UTILIZATION',
    accountId,
    generatedAt,
    format,
    sizeBytes: Math.floor(Math.random() * 150000) + 30000,
  });

  return report;
}

// ---------------------------------------------------------------------------
// Regulatory report
// ---------------------------------------------------------------------------

/**
 * Generate a regulatory compliance and filing report.
 *
 * @param {{ reportType: string, accountId?: string, startDate: string, endDate: string, jurisdiction?: string, format?: string }} params
 * @returns {Promise<object>}
 */
async function generateRegulatoryReport({ reportType, accountId, startDate, endDate, jurisdiction = 'US', format = 'PDF' }) {
  const reportId = uuidv4();
  const generatedAt = new Date().toISOString();

  const filedAt = new Date().toISOString();

  const regulatoryBody = {
    FINRA: 'FINRA',
    SEC: 'SEC',
    FORM_1099: 'IRS',
    FORM_8949: 'IRS',
    LARGE_TRADER: 'SEC',
    SAR: 'FinCEN',
    BEST_EXECUTION: 'FINRA',
  }[reportType] || 'SEC';

  const filingReference = `${regulatoryBody}-${reportType}-${Date.now().toString(36).toUpperCase()}`;

  // Simulate regulatory report data
  const reportData = buildRegulatoryReportData(reportType, accountId, startDate, endDate);

  const report = {
    reportId,
    reportType,
    regulatoryBody,
    jurisdiction,
    accountId: accountId || null,
    startDate,
    endDate,
    format,
    status: 'GENERATED',
    generatedAt,
    filedAt,
    filingReference,
    downloadUrl: buildDownloadUrl(reportId, format),
    data: reportData,
  };

  reportStore.set(reportId, report);

  await publishEvent('report.generated', {
    reportId,
    reportType,
    accountId: accountId || null,
    generatedAt,
    format,
    sizeBytes: Math.floor(Math.random() * 300000) + 80000,
  });

  await publishEvent('report.delivered', {
    reportId,
    reportType,
    accountId: accountId || null,
    deliveredAt: filedAt,
    deliveryChannel: 'REGULATORY_PORTAL',
    recipient: regulatoryBody,
  });

  return report;
}

/**
 * Build simulated regulatory report payload based on report type.
 */
function buildRegulatoryReportData(reportType, accountId, startDate, endDate) {
  switch (reportType) {
    case 'FORM_1099':
      return {
        taxYear: new Date(endDate).getFullYear(),
        ordinaryDividends: parseFloat((Math.random() * 5000).toFixed(2)),
        qualifiedDividends: parseFloat((Math.random() * 3000).toFixed(2)),
        totalProceeds: parseFloat((Math.random() * 200000).toFixed(2)),
        federalTaxWithheld: parseFloat((Math.random() * 500).toFixed(2)),
        currency: 'USD',
      };
    case 'FORM_8949':
      return {
        taxYear: new Date(endDate).getFullYear(),
        shortTermTransactions: Math.floor(Math.random() * 50),
        longTermTransactions: Math.floor(Math.random() * 30),
        shortTermNetGainLoss: parseFloat(((Math.random() - 0.4) * 10000).toFixed(2)),
        longTermNetGainLoss: parseFloat(((Math.random() - 0.4) * 20000).toFixed(2)),
        currency: 'USD',
      };
    case 'LARGE_TRADER':
      return {
        reportingPeriod: `${startDate} to ${endDate}`,
        largeTraderIdentifier: `LT-${uuidv4().substring(0, 8).toUpperCase()}`,
        aggregateTransactionVolume: parseFloat((Math.random() * 10000000).toFixed(2)),
        transactionCount: Math.floor(Math.random() * 2000) + 500,
        securityTypes: ['EQUITY', 'OPTIONS', 'FUTURES'],
        currency: 'USD',
      };
    case 'SAR':
      return {
        reportingPeriod: `${startDate} to ${endDate}`,
        filingType: 'INITIAL',
        suspiciousActivityAmount: parseFloat((Math.random() * 50000 + 25000).toFixed(2)),
        activityType: 'UNUSUAL_TRADING_PATTERN',
        currency: 'USD',
      };
    case 'BEST_EXECUTION':
      return {
        reportingPeriod: `${startDate} to ${endDate}`,
        totalOrdersAnalyzed: Math.floor(Math.random() * 5000) + 500,
        averagePriceImprovement: parseFloat((Math.random() * 0.02).toFixed(6)),
        executionVenueBreakdown: {
          NYSE: parseFloat((Math.random() * 50 + 20).toFixed(2)),
          NASDAQ: parseFloat((Math.random() * 40 + 10).toFixed(2)),
          CBOE: parseFloat((Math.random() * 20).toFixed(2)),
        },
        priceImprovementRate: parseFloat((Math.random() * 30 + 60).toFixed(2)),
      };
    default:
      return {
        reportingPeriod: `${startDate} to ${endDate}`,
        accountId,
        recordCount: Math.floor(Math.random() * 1000) + 100,
      };
  }
}

// ---------------------------------------------------------------------------
// Report scheduling
// ---------------------------------------------------------------------------

/**
 * Schedule automated report generation and delivery.
 *
 * @param {{ reportType: string, accountId: string, frequency: string, deliveryChannel: string, deliveryAddress: string, startDate?: string, format?: string }} params
 * @returns {Promise<object>}
 */
async function scheduleReport({ reportType, accountId, frequency, deliveryChannel, deliveryAddress, startDate, format = 'PDF' }) {
  const scheduleId = uuidv4();
  const createdAt = new Date().toISOString();
  const nextRunAt = calculateNextRunAt(frequency, startDate);

  const schedule = {
    scheduleId,
    reportType,
    accountId,
    frequency,
    deliveryChannel,
    deliveryAddress,
    startDate: startDate || createdAt.split('T')[0],
    format,
    status: 'ACTIVE',
    createdAt,
    nextRunAt,
    lastRunAt: null,
    runCount: 0,
  };

  scheduleStore.set(scheduleId, schedule);

  return schedule;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  generateStatement,
  generateTradeConfirmations,
  generateMarginUtilizationReport,
  generateRegulatoryReport,
  scheduleReport,
  // Expose stores for testing
  _reportStore: reportStore,
  _scheduleStore: scheduleStore,
};
