// This service contains no business logic. It translates foreign API responses to internal events only.

const { v4: uuidv4 } = require('uuid');

/**
 * Translates a DTCC settlement instruction acknowledgement response
 * into a settlement.submitted internal event payload.
 *
 * @param {object} dtccResponse - Raw response from POST /v1/settlement/instructions
 * @returns {object} Internal settlement.submitted event payload
 */
function toSettlementSubmitted(dtccResponse) {
  return {
    eventId: uuidv4(),
    topic: 'settlement.submitted',
    occurredAt: new Date().toISOString(),
    tradeId: dtccResponse.tradeId || dtccResponse.trade_id || null,
    settlementId: dtccResponse.settlementId || dtccResponse.settlement_id || null,
    accountId: dtccResponse.accountId || dtccResponse.account_id || null,
    symbol: dtccResponse.securitySymbol || dtccResponse.symbol || null,
    quantity: dtccResponse.quantity != null ? Number(dtccResponse.quantity) : null,
    netAmount: dtccResponse.netAmount != null ? Number(dtccResponse.netAmount) : null,
    currency: dtccResponse.currency || 'USD',
    settlementDate: dtccResponse.settlementDate || dtccResponse.settlement_date || null,
    counterpartyId: dtccResponse.counterpartyId || dtccResponse.counterparty_id || null,
    instructionType: dtccResponse.instructionType || dtccResponse.instruction_type || null,
    status: dtccResponse.status || 'SUBMITTED',
  };
}

/**
 * Translates a DTCC settlement confirmation response
 * into a settlement.confirmed internal event payload.
 *
 * @param {object} dtccResponse - Raw response from DTCC when settlement status is CONFIRMED/SETTLED
 * @returns {object} Internal settlement.confirmed event payload
 */
function toSettlementConfirmed(dtccResponse) {
  return {
    eventId: uuidv4(),
    topic: 'settlement.confirmed',
    occurredAt: new Date().toISOString(),
    tradeId: dtccResponse.tradeId || dtccResponse.trade_id || null,
    settlementId: dtccResponse.settlementId || dtccResponse.settlement_id || null,
    accountId: dtccResponse.accountId || dtccResponse.account_id || null,
    symbol: dtccResponse.securitySymbol || dtccResponse.symbol || null,
    quantity: dtccResponse.quantity != null ? Number(dtccResponse.quantity) : null,
    settledAmount: dtccResponse.settledAmount != null ? Number(dtccResponse.settledAmount)
      : dtccResponse.net_amount != null ? Number(dtccResponse.net_amount) : null,
    currency: dtccResponse.currency || 'USD',
    settledAt: dtccResponse.settledAt || dtccResponse.settled_at || dtccResponse.settlementDate || null,
    counterpartyId: dtccResponse.counterpartyId || dtccResponse.counterparty_id || null,
    confirmationReference: dtccResponse.confirmationReference || dtccResponse.confirmation_reference || dtccResponse.dtccRef || null,
  };
}

/**
 * Translates a DTCC failed settlement response
 * into a settlement.failed internal event payload.
 *
 * @param {object} dtccResponse - Raw response from DTCC when settlement status is FAILED
 * @returns {object} Internal settlement.failed event payload
 */
function toSettlementFailed(dtccResponse) {
  return {
    eventId: uuidv4(),
    topic: 'settlement.failed',
    occurredAt: new Date().toISOString(),
    tradeId: dtccResponse.tradeId || dtccResponse.trade_id || null,
    settlementId: dtccResponse.settlementId || dtccResponse.settlement_id || null,
    accountId: dtccResponse.accountId || dtccResponse.account_id || null,
    symbol: dtccResponse.securitySymbol || dtccResponse.symbol || null,
    quantity: dtccResponse.quantity != null ? Number(dtccResponse.quantity) : null,
    failureReason: dtccResponse.failureReason || dtccResponse.failure_reason || dtccResponse.reason || null,
    failureCode: dtccResponse.failureCode || dtccResponse.failure_code || dtccResponse.errorCode || null,
    failedAt: dtccResponse.failedAt || dtccResponse.failed_at || dtccResponse.updatedAt || new Date().toISOString(),
    counterpartyId: dtccResponse.counterpartyId || dtccResponse.counterparty_id || null,
    retryEligible: dtccResponse.retryEligible != null ? Boolean(dtccResponse.retryEligible)
      : dtccResponse.retry_eligible != null ? Boolean(dtccResponse.retry_eligible) : false,
  };
}

/**
 * Translates a DTCC settlement exception response
 * into a settlement.exception internal event payload.
 *
 * @param {object} dtccResponse - Raw response from POST /v1/settlement/exceptions or a report record with exception status
 * @returns {object} Internal settlement.exception event payload
 */
function toSettlementException(dtccResponse) {
  return {
    eventId: uuidv4(),
    topic: 'settlement.exception',
    occurredAt: new Date().toISOString(),
    tradeId: dtccResponse.tradeId || dtccResponse.trade_id || null,
    settlementId: dtccResponse.settlementId || dtccResponse.settlement_id || null,
    accountId: dtccResponse.accountId || dtccResponse.account_id || null,
    symbol: dtccResponse.securitySymbol || dtccResponse.symbol || null,
    exceptionType: dtccResponse.exceptionType || dtccResponse.exception_type || dtccResponse.type || null,
    exceptionDescription: dtccResponse.exceptionDescription || dtccResponse.exception_description
      || dtccResponse.description || dtccResponse.message || null,
    raisedAt: dtccResponse.raisedAt || dtccResponse.raised_at || dtccResponse.createdAt || new Date().toISOString(),
    priority: dtccResponse.priority || 'NORMAL',
    assignedTo: dtccResponse.assignedTo || dtccResponse.assigned_to || null,
  };
}

module.exports = {
  toSettlementSubmitted,
  toSettlementConfirmed,
  toSettlementFailed,
  toSettlementException,
};
