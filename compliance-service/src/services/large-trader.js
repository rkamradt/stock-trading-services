'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store for large trader reports.
 * @type {Map<string, Object>}
 */
const largeTraderReports = new Map();

/**
 * In-memory store for large trader IDs per account.
 * @type {Map<string, string>}
 */
const largeTraderIds = new Map([
  ['acct-001', 'LT-20240101-00001'],
  ['acct-009', 'LT-20240115-00002'],
]);

// Seed with example reports
(function seedLargeTraderReports() {
  const seed = [
    {
      reportId: 'ltr-001',
      accountId: 'acct-001',
      largeTraderId: 'LT-20240101-00001',
      reportDate: '2024-01-31T23:59:59.000Z',
      reportingPeriod: 'MONTHLY',
      positions: [
        { symbol: 'AAPL', quantity: 25000, marketValue: 4637500, transactionVolume: 12000000 },
        { symbol: 'MSFT', quantity: 15000, marketValue: 5614050, transactionVolume: 8000000 },
        { symbol: 'GOOGL', quantity: 8000, marketValue: 10944000, transactionVolume: 5000000 },
      ],
      totalMarketValue: 21195550,
      totalTransactionVolume: 25000000,
      thresholdExceeded: true,
      thresholdAmount: 20000000,
      status: 'FILED',
      filedAt: '2024-02-05T10:00:00.000Z',
      filingReference: 'LTID-FINRA-2024-01-LT-00001',
      createdAt: '2024-02-05T09:30:00.000Z',
    },
  ];
  seed.forEach((r) => largeTraderReports.set(r.reportId, r));
})();

const LARGE_TRADER_THRESHOLD = 20_000_000; // $20M daily transaction threshold per SEC Rule 13h-1

/**
 * Generate a large trader position report.
 *
 * @param {Object} params
 * @param {string} params.accountId
 * @param {string} params.reportDate
 * @param {string} params.reportingPeriod
 * @param {Object[]} params.positions
 * @param {string} [params.largeTraderId]
 * @returns {Promise<Object>}
 */
async function generateLargeTraderReport(params) {
  const { accountId, reportDate, reportingPeriod, positions, largeTraderId } = params;

  const totalMarketValue = positions.reduce((sum, p) => sum + (p.marketValue || 0), 0);
  const totalTransactionVolume = positions.reduce((sum, p) => sum + (p.transactionVolume || 0), 0);
  const thresholdExceeded = totalTransactionVolume >= LARGE_TRADER_THRESHOLD;

  // Assign or retrieve large trader ID
  let ltid = largeTraderId || largeTraderIds.get(accountId);
  if (!ltid) {
    ltid = `LT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;
    largeTraderIds.set(accountId, ltid);
  }

  const reportId = `ltr-${uuidv4()}`;
  const now = new Date().toISOString();
  const filingReference = thresholdExceeded
    ? `LTID-FINRA-${new Date().getFullYear()}-${reportingPeriod.slice(0, 2)}-${ltid}`
    : null;

  const report = {
    reportId,
    accountId,
    largeTraderId: ltid,
    reportDate,
    reportingPeriod,
    positions: positions.map((p) => ({
      symbol: p.symbol,
      quantity: p.quantity,
      marketValue: p.marketValue,
      transactionVolume: p.transactionVolume,
    })),
    totalMarketValue,
    totalTransactionVolume,
    thresholdExceeded,
    thresholdAmount: LARGE_TRADER_THRESHOLD,
    status: thresholdExceeded ? 'FILED' : 'BELOW_THRESHOLD',
    filedAt: thresholdExceeded ? now : null,
    filingReference,
    createdAt: now,
  };

  largeTraderReports.set(reportId, report);

  if (thresholdExceeded) {
    emitEvent('compliance.report_filed', {
      reportId,
      reportType: 'LARGE_TRADER_13H',
      regulatoryBody: 'SEC',
      periodStart: reportDate,
      periodEnd: reportDate,
      filedAt: now,
      filedBy: `large-trader-system`,
    });
  }

  return report;
}

/**
 * Get a large trader report by ID.
 *
 * @param {string} reportId
 * @returns {Promise<Object>}
 */
async function getLargeTraderReport(reportId) {
  const report = largeTraderReports.get(reportId);
  if (!report) {
    const err = new Error(`Large trader report '${reportId}' not found`);
    err.status = 404;
    throw err;
  }
  return report;
}

/**
 * List large trader reports with optional filtering.
 *
 * @param {Object} [filters]
 * @param {string} [filters.accountId]
 * @param {string} [filters.status]
 * @param {number} [filters.limit]
 * @param {number} [filters.offset]
 * @returns {Promise<Object>}
 */
async function listLargeTraderReports(filters = {}) {
  const { accountId, status, limit = 50, offset = 0 } = filters;
  let reports = Array.from(largeTraderReports.values());

  if (accountId) reports = reports.filter((r) => r.accountId === accountId);
  if (status) reports = reports.filter((r) => r.status === status);

  const total = reports.length;
  return {
    total,
    limit,
    offset,
    reports: reports.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(offset, offset + limit),
  };
}

/**
 * Internal event emitter stub.
 * @param {string} topic
 * @param {Object} payload
 */
function emitEvent(topic, payload) {
  console.log(`[EVENT] ${topic}:`, JSON.stringify(payload));
}

module.exports = {
  generateLargeTraderReport,
  getLargeTraderReport,
  listLargeTraderReports,
};
