'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store for regulatory reports.
 * @type {Map<string, Object>}
 */
const regulatoryReports = new Map();

// Seed with example data
(function seedReports() {
  const seed = [
    {
      reportId: 'rpt-001',
      reportType: 'FINRA_TRADE_REPORT',
      regulatoryBody: 'FINRA',
      periodStart: '2024-01-01T00:00:00.000Z',
      periodEnd: '2024-01-31T23:59:59.000Z',
      accountIds: ['acct-001', 'acct-002'],
      entityIds: [],
      submittedBy: 'compliance-officer@firm.com',
      status: 'FILED',
      filedAt: '2024-02-05T09:00:00.000Z',
      downloadUrl: '/reports/rpt-001/download',
      filingReference: 'FINRA-2024-01-TRD-00123',
      createdAt: '2024-02-05T08:45:00.000Z',
    },
    {
      reportId: 'rpt-002',
      reportType: 'SEC_FORM_13F',
      regulatoryBody: 'SEC',
      periodStart: '2024-01-01T00:00:00.000Z',
      periodEnd: '2024-03-31T23:59:59.000Z',
      accountIds: [],
      entityIds: ['entity-001'],
      submittedBy: 'compliance-manager@firm.com',
      status: 'PENDING_REVIEW',
      filedAt: null,
      downloadUrl: '/reports/rpt-002/download',
      filingReference: null,
      createdAt: '2024-04-10T10:00:00.000Z',
    },
  ];
  seed.forEach((r) => regulatoryReports.set(r.reportId, r));
})();

/**
 * Generate a new regulatory report and file it with the appropriate authority.
 * Emits compliance.report_filed event on successful filing.
 *
 * @param {Object} params
 * @param {string} params.reportType
 * @param {string} params.regulatoryBody
 * @param {string} params.periodStart
 * @param {string} params.periodEnd
 * @param {string} params.submittedBy
 * @param {string[]} [params.accountIds]
 * @param {string[]} [params.entityIds]
 * @returns {Promise<Object>}
 */
async function generateRegulatoryReport(params) {
  const { reportType, regulatoryBody, periodStart, periodEnd, submittedBy, accountIds = [], entityIds = [] } = params;

  const periodStartDate = new Date(periodStart);
  const periodEndDate = new Date(periodEnd);

  if (periodEndDate <= periodStartDate) {
    const err = new Error('periodEnd must be after periodStart');
    err.status = 400;
    throw err;
  }

  const reportId = `rpt-${uuidv4()}`;
  const now = new Date().toISOString();
  const filingReference = `${regulatoryBody}-${new Date().getFullYear()}-${reportType.slice(0, 3)}-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`;

  const report = {
    reportId,
    reportType,
    regulatoryBody,
    periodStart,
    periodEnd,
    accountIds,
    entityIds,
    submittedBy,
    status: 'FILED',
    filedAt: now,
    downloadUrl: `/reports/${reportId}/download`,
    filingReference,
    createdAt: now,
  };

  regulatoryReports.set(reportId, report);

  // Emit compliance.report_filed event (in production, publish to message broker)
  emitEvent('compliance.report_filed', {
    reportId,
    reportType,
    regulatoryBody,
    periodStart,
    periodEnd,
    filedAt: now,
    filedBy: submittedBy,
  });

  return report;
}

/**
 * List all regulatory reports.
 * @returns {Promise<Object[]>}
 */
async function listRegulatoryReports() {
  return Array.from(regulatoryReports.values());
}

/**
 * Get a single regulatory report by ID.
 * @param {string} reportId
 * @returns {Promise<Object>}
 */
async function getRegulatoryReport(reportId) {
  const report = regulatoryReports.get(reportId);
  if (!report) {
    const err = new Error(`Regulatory report '${reportId}' not found`);
    err.status = 404;
    throw err;
  }
  return report;
}

/**
 * Internal event emitter stub.
 * In production, replace with Kafka/RabbitMQ/SNS publisher.
 *
 * @param {string} topic
 * @param {Object} payload
 */
function emitEvent(topic, payload) {
  console.log(`[EVENT] ${topic}:`, JSON.stringify(payload));
}

module.exports = {
  generateRegulatoryReport,
  listRegulatoryReports,
  getRegulatoryReport,
};
