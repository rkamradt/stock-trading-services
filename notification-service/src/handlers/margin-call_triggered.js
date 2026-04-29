/**
 * Handler for topic: margin.call_triggered
 *
 * Purpose: Listens for margin calls to alert customers.
 *
 * When a margin call is triggered, this handler:
 *   1. Identifies the customer associated with the affected account
 *   2. Builds an urgent margin call notification with deficiency details
 *   3. Dispatches the notification to ALL available channels (bypasses quiet hours)
 *   4. Returns outbound Kafka events for notification.sent or notification.failed
 *
 * Expected payload shape (from MarginService `margin.call_triggered`):
 * {
 *   accountId: string,
 *   customerId: string,
 *   deficiencyAmount: number,
 *   currentMarginLevel: number,       // percentage
 *   maintenanceMarginLevel: number,   // percentage (threshold breached)
 *   requiredDepositAmount: number,
 *   deadline: string (ISO 8601),
 *   positions: Array<{ symbol, marketValue, marginRequirement }>,
 *   triggeredAt: string (ISO 8601)
 * }
 */

const {
  processMarginCallNotification,
} = require('../services/notification_service');

/**
 * @param {object} payload - Parsed message payload from the margin.call_triggered topic
 * @returns {Promise<object[]|null>} Array of { topic, payload } outbound events, or null
 */
async function handle(payload) {
  const {
    accountId,
    customerId,
    deficiencyAmount,
    currentMarginLevel,
    maintenanceMarginLevel,
    requiredDepositAmount,
    deadline,
    positions,
    triggeredAt,
  } = payload;

  if (!customerId) {
    console.warn('[margin-call_triggered] Missing customerId in payload — cannot deliver notification', { accountId });
    return null;
  }

  if (!accountId) {
    console.warn('[margin-call_triggered] Missing accountId in payload — skipping notification', { customerId });
    return null;
  }

  console.log(
    `[margin-call_triggered] Processing urgent margin call notification for customer ${customerId}, ` +
    `account ${accountId} — deficiency $${deficiencyAmount}`
  );

  const { sentEvents, failedEvents } = processMarginCallNotification({
    accountId,
    customerId,
    deficiencyAmount: deficiencyAmount || 0,
    currentMarginLevel: currentMarginLevel || 0,
    maintenanceMarginLevel: maintenanceMarginLevel || 0,
    requiredDepositAmount: requiredDepositAmount || 0,
    deadline: deadline || null,
    positions: positions || [],
    triggeredAt: triggeredAt || new Date().toISOString(),
  });

  const outboundEvents = [...sentEvents, ...failedEvents];

  if (outboundEvents.length === 0) {
    console.warn(`[margin-call_triggered] No notification channels available for customer ${customerId}`);
    return null;
  }

  console.log(
    `[margin-call_triggered] Emitting ${outboundEvents.length} event(s) for margin call on account ${accountId}`
  );
  return outboundEvents;
}

module.exports = handle;
