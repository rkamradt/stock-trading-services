/**
 * Handler for topic: risk.limit_breached
 *
 * Purpose: Listens for risk breaches to notify customers.
 *
 * When a risk limit is breached, this handler:
 *   1. Identifies the customer associated with the affected account
 *   2. Builds a risk alert notification with breach details
 *   3. Dispatches the notification via the customer's preferred channels
 *      (critical severity bypasses quiet hours and uses all channels)
 *   4. Returns outbound Kafka events for notification.sent or notification.failed
 *
 * Expected payload shape (from RiskManagementService `risk.limit_breached`):
 * {
 *   accountId: string,
 *   customerId: string,
 *   limitType: string,        // e.g. "CONCENTRATION_LIMIT", "VAR_LIMIT", "POSITION_LIMIT"
 *   currentValue: number,
 *   limitThreshold: number,
 *   severity: "warning" | "critical",
 *   affectedSymbol: string | null,
 *   portfolioId: string | null,
 *   ruleId: string,
 *   triggeredAt: string (ISO 8601)
 * }
 */

const {
  processRiskBreachNotification,
} = require('../services/notification_service');

/**
 * @param {object} payload - Parsed message payload from the risk.limit_breached topic
 * @returns {Promise<object[]|null>} Array of { topic, payload } outbound events, or null
 */
async function handle(payload) {
  const {
    accountId,
    customerId,
    limitType,
    currentValue,
    limitThreshold,
    severity,
    affectedSymbol,
    portfolioId,
    ruleId,
    triggeredAt,
  } = payload;

  if (!customerId) {
    console.warn('[risk-limit_breached] Missing customerId in payload — cannot deliver notification', { accountId, ruleId });
    return null;
  }

  if (!accountId || !limitType) {
    console.warn('[risk-limit_breached] Incomplete risk breach payload — skipping notification', { customerId, limitType });
    return null;
  }

  console.log(
    `[risk-limit_breached] Processing risk breach notification for customer ${customerId}, ` +
    `account ${accountId} — ${limitType} at ${currentValue} (limit: ${limitThreshold}), severity: ${severity}`
  );

  const { sentEvents, failedEvents } = processRiskBreachNotification({
    accountId,
    customerId,
    limitType,
    currentValue: currentValue != null ? currentValue : 0,
    limitThreshold: limitThreshold != null ? limitThreshold : 0,
    severity: severity || 'warning',
    affectedSymbol: affectedSymbol || null,
    portfolioId: portfolioId || null,
    ruleId: ruleId || null,
    triggeredAt: triggeredAt || new Date().toISOString(),
  });

  const outboundEvents = [...sentEvents, ...failedEvents];

  if (outboundEvents.length === 0) {
    console.log(
      `[risk-limit_breached] No outbound events generated for risk breach on account ${accountId} ` +
      `(quiet hours or no channels configured)`
    );
    return null;
  }

  console.log(
    `[risk-limit_breached] Emitting ${outboundEvents.length} event(s) for risk breach on account ${accountId}`
  );
  return outboundEvents;
}

module.exports = handle;
