'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * In-memory store for compliance rules.
 * @type {Map<string, Object>}
 */
const complianceRules = new Map();

// Seed with default compliance rules
(function seedRules() {
  const defaultRules = [
    {
      ruleId: 'rule-wash-trading',
      ruleName: 'Wash Trading Detection',
      description: 'Detects offsetting buy/sell transactions in the same security within a configurable time window.',
      category: 'TRADE_SURVEILLANCE',
      thresholds: {
        timeWindowMinutes: 5,
        minimumTransactionCount: 3,
        minimumTotalValue: 10000,
      },
      enabled: true,
      severity: 'HIGH',
      applicableEntityTypes: ['ACCOUNT'],
      actionOnBreach: 'FLAG_AND_ALERT',
      regulatoryReference: 'SEC Rule 10b-5; FINRA Rule 2010',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      updatedBy: 'system',
    },
    {
      ruleId: 'rule-layering',
      ruleName: 'Layering / Spoofing Detection',
      description: 'Detects placement and rapid cancellation of large orders intended to mislead other market participants.',
      category: 'TRADE_SURVEILLANCE',
      thresholds: {
        cancellationRateThreshold: 0.85,
        minimumOrderSize: 5000,
        timeWindowSeconds: 30,
        minimumCancellations: 5,
      },
      enabled: true,
      severity: 'CRITICAL',
      applicableEntityTypes: ['ACCOUNT'],
      actionOnBreach: 'SUSPEND_TRADING_AND_ESCALATE',
      regulatoryReference: 'Dodd-Frank Section 747; SEC Rule 10b-5',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      updatedBy: 'system',
    },
    {
      ruleId: 'rule-large-trader',
      ruleName: 'Large Trader Reporting Threshold',
      description: 'Identifies accounts that exceed the SEC large trader transaction volume threshold requiring Form 13H filing.',
      category: 'REGULATORY_REPORTING',
      thresholds: {
        dailyTransactionVolume: 20000000,
        equityThreshold: 100,
        reportingDeadlineDays: 10,
      },
      enabled: true,
      severity: 'HIGH',
      applicableEntityTypes: ['ACCOUNT', 'CUSTOMER'],
      actionOnBreach: 'GENERATE_13H_REPORT',
      regulatoryReference: 'SEC Rule 13h-1',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      updatedBy: 'system',
    },
    {
      ruleId: 'rule-concentration-limit',
      ruleName: 'Portfolio Concentration Limit',
      description: 'Flags accounts where a single security exceeds the allowed percentage of total portfolio value.',
      category: 'RISK_COMPLIANCE',
      thresholds: {
        maxSingleSecurityPercentage: 0.25,
        maxSectorPercentage: 0.40,
        checkFrequencyHours: 24,
      },
      enabled: true,
      severity: 'MEDIUM',
      applicableEntityTypes: ['ACCOUNT'],
      actionOnBreach: 'ALERT_COMPLIANCE_OFFICER',
      regulatoryReference: 'Internal Risk Policy RPC-004',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      updatedBy: 'system',
    },
    {
      ruleId: 'rule-aml-structuring',
      ruleName: 'AML Structuring Detection',
      description: 'Detects patterns of transactions intentionally structured to avoid CTR thresholds.',
      category: 'AML',
      thresholds: {
        ctrThreshold: 10000,
        lookbackDays: 30,
        minimumTransactionCount: 3,
        proximityPercentage: 0.05,
      },
      enabled: true,
      severity: 'CRITICAL',
      applicableEntityTypes: ['CUSTOMER', 'ACCOUNT'],
      actionOnBreach: 'FILE_SAR_AND_FREEZE',
      regulatoryReference: '31 U.S.C. § 5324; FinCEN CDD Rule',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      updatedBy: 'system',
    },
    {
      ruleId: 'rule-best-execution',
      ruleName: 'Best Execution Compliance',
      description: 'Monitors trade execution quality against market prices at time of execution.',
      category: 'BEST_EXECUTION',
      thresholds: {
        minimumBestExecutionScore: 75,
        maxSlippageBps: 50,
        reviewTriggerScore: 60,
      },
      enabled: true,
      severity: 'MEDIUM',
      applicableEntityTypes: ['TRADE', 'ORDER'],
      actionOnBreach: 'REQUIRE_REVIEW',
      regulatoryReference: 'SEC Rule 606; FINRA Rule 5310',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
      updatedBy: 'system',
    },
  ];

  defaultRules.forEach((r) => complianceRules.set(r.ruleId, r));
})();

/**
 * Update a compliance rule's configuration and thresholds.
 *
 * @param {string} ruleId
 * @param {Object} updates
 * @param {string} updates.updatedBy
 * @param {string} [updates.ruleName]
 * @param {string} [updates.description]
 * @param {Object} [updates.thresholds]
 * @param {boolean} [updates.enabled]
 * @param {string} [updates.severity]
 * @param {string[]} [updates.applicableEntityTypes]
 * @returns {Promise<Object>}
 */
async function updateRule(ruleId, updates) {
  const rule = complianceRules.get(ruleId);
  if (!rule) {
    const err = new Error(`Compliance rule '${ruleId}' not found`);
    err.status = 404;
    throw err;
  }

  const now = new Date().toISOString();
  const { updatedBy, ruleName, description, thresholds, enabled, severity, applicableEntityTypes } = updates;

  const updatedRule = {
    ...rule,
    ruleName: ruleName !== undefined ? ruleName : rule.ruleName,
    description: description !== undefined ? description : rule.description,
    thresholds: thresholds !== undefined ? { ...rule.thresholds, ...thresholds } : rule.thresholds,
    enabled: enabled !== undefined ? enabled : rule.enabled,
    severity: severity !== undefined ? severity : rule.severity,
    applicableEntityTypes: applicableEntityTypes !== undefined ? applicableEntityTypes : rule.applicableEntityTypes,
    updatedAt: now,
    updatedBy,
  };

  complianceRules.set(ruleId, updatedRule);
  return updatedRule;
}

/**
 * Get a compliance rule by ID.
 *
 * @param {string} ruleId
 * @returns {Promise<Object>}
 */
async function getRule(ruleId) {
  const rule = complianceRules.get(ruleId);
  if (!rule) {
    const err = new Error(`Compliance rule '${ruleId}' not found`);
    err.status = 404;
    throw err;
  }
  return rule;
}

/**
 * List all compliance rules.
 *
 * @param {Object} [filters]
 * @param {string} [filters.category]
 * @param {boolean} [filters.enabled]
 * @param {string} [filters.severity]
 * @returns {Promise<Object>}
 */
async function listRules(filters = {}) {
  const { category, enabled, severity } = filters;
  let rules = Array.from(complianceRules.values());

  if (category !== undefined) rules = rules.filter((r) => r.category === category);
  if (enabled !== undefined) rules = rules.filter((r) => r.enabled === enabled);
  if (severity !== undefined) rules = rules.filter((r) => r.severity === severity);

  return {
    total: rules.length,
    rules: rules.sort((a, b) => a.ruleName.localeCompare(b.ruleName)),
  };
}

/**
 * Create a new compliance rule.
 *
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function createRule(params) {
  const ruleId = `rule-${uuidv4()}`;
  const now = new Date().toISOString();

  const rule = {
    ruleId,
    ruleName: params.ruleName,
    description: params.description || '',
    category: params.category || 'GENERAL',
    thresholds: params.thresholds || {},
    enabled: params.enabled !== undefined ? params.enabled : true,
    severity: params.severity || 'MEDIUM',
    applicableEntityTypes: params.applicableEntityTypes || [],
    actionOnBreach: params.actionOnBreach || 'ALERT_COMPLIANCE_OFFICER',
    regulatoryReference: params.regulatoryReference || null,
    createdAt: now,
    updatedAt: now,
    updatedBy: params.createdBy || 'system',
  };

  complianceRules.set(ruleId, rule);
  return rule;
}

module.exports = {
  updateRule,
  getRule,
  listRules,
  createRule,
};
