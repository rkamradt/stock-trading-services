'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store of generated compliance exposure reports.
 * Keyed by reportId.
 *
 * @type {Map<string, object>}
 */
const exposureReportStore = new Map();

/**
 * Simulated aggregated exposure data by asset class.
 * In production these figures would be aggregated from portfolio-service
 * and account-service in real time.
 */
const SIMULATED_EXPOSURES = [
  {
    assetClass: 'EQUITY',
    grossExposure: 85000000.0,
    netExposure: 76500000.0,
    numberOfAccounts: 1820,
    numberOfPositions: 14650,
    regulatoryLimit: 300000000.0,
    utilizationPct: 0.283,
  },
  {
    assetClass: 'OPTION',
    grossExposure: 12000000.0,
    netExposure: -2500000.0,
    numberOfAccounts: 340,
    numberOfPositions: 2100,
    regulatoryLimit: 50000000.0,
    utilizationPct: 0.24,
  },
  {
    assetClass: 'FUTURE',
    grossExposure: 6500000.0,
    netExposure: 3200000.0,
    numberOfAccounts: 85,
    numberOfPositions: 310,
    regulatoryLimit: 20000000.0,
    utilizationPct: 0.325,
  },
  {
    assetClass: 'ETF',
    grossExposure: 21000000.0,
    netExposure: 21000000.0,
    numberOfAccounts: 950,
    numberOfPositions: 4200,
    regulatoryLimit: 100000000.0,
    utilizationPct: 0.21,
  },
];

/**
 * Total AUM across all accounts and asset classes.
 */
const TOTAL_AUM = SIMULATED_EXPOSURES.reduce((sum, e) => sum + e.grossExposure, 0);

/**
 * Simulated large trader threshold breach count.
 * A "large trader" under SEC Rule 13h-1 holds or exercises ≥ $20M in NMS securities daily.
 */
const LARGE_TRADER_THRESHOLD_BREACHES = 7;

/**
 * Simulated concentration warnings count.
 * Accounts with a single position > 10% of portfolio value.
 */
const CONCENTRATION_WARNINGS = 23;

/**
 * Generate or retrieve the current regulatory exposure report.
 * Applies optional filters for assetClass and reportDate.
 *
 * @param {{ assetClass?: string|null, reportDate?: string|null }} filters
 * @returns {Promise<object>}
 */
async function getExposures({ assetClass = null, reportDate = null } = {}) {
  const reportId = uuidv4();
  const generatedAt = new Date().toISOString();
  const effectiveReportDate = reportDate || new Date().toISOString().split('T')[0];

  let exposures = [...SIMULATED_EXPOSURES];

  if (assetClass) {
    exposures = exposures.filter((e) => e.assetClass === assetClass);
  }

  // Compute filtered totals
  const filteredAUM = exposures.reduce((sum, e) => sum + e.grossExposure, 0);

  const report = {
    reportId,
    reportDate: effectiveReportDate,
    totalAUM: assetClass ? filteredAUM : TOTAL_AUM,
    exposures: exposures.map((e) => ({
      ...e,
      utilizationPct: parseFloat(e.utilizationPct.toFixed(4)),
    })),
    largeTraderThresholdBreaches: LARGE_TRADER_THRESHOLD_BREACHES,
    concentrationWarnings: CONCENTRATION_WARNINGS,
    regulatoryFramework: {
      equityReporting: 'SEC Rule 13h-1 (Large Trader)',
      derivativesReporting: 'CFTC Part 20 (Large Trader)',
      aggregatedReporting: 'FINRA Rule 4521',
    },
    generatedAt,
    filters: {
      assetClass: assetClass || 'ALL',
      reportDate: effectiveReportDate,
    },
  };

  exposureReportStore.set(reportId, report);

  return report;
}

/**
 * Retrieve a previously generated exposure report by its ID.
 *
 * @param {string} reportId
 * @returns {Promise<object>}
 */
async function getExposureReport(reportId) {
  const report = exposureReportStore.get(reportId);
  if (!report) {
    const err = new Error(`Exposure report ${reportId} not found`);
    err.status = 404;
    throw err;
  }
  return { ...report };
}

/**
 * List all previously generated exposure reports.
 *
 * @returns {Promise<object[]>}
 */
async function listExposureReports() {
  return Array.from(exposureReportStore.values()).map((r) => ({ ...r }));
}

/**
 * Emit a compliance alert (simulated — logs to stdout in lieu of a message bus).
 *
 * @param {{ alertType: string, description: string, affectedEntities: string[], regulatoryBody: string }} alertData
 */
function emitComplianceAlert(alertData) {
  const event = {
    eventId: uuidv4(),
    alertType: alertData.alertType,
    description: alertData.description,
    affectedEntities: alertData.affectedEntities,
    regulatoryBody: alertData.regulatoryBody,
    filedAt: new Date().toISOString(),
  };
  console.info('[event] risk.compliance_alert', event);
  return event;
}

module.exports = {
  getExposures,
  getExposureReport,
  listExposureReports,
  emitComplianceAlert,
};
