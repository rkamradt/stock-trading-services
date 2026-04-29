/**
 * Handler for topic: order.filled
 *
 * Purpose: Listens for trade confirmations to send to customers.
 *
 * When an order is filled (fully or partially), this handler:
 *   1. Retrieves the customer's notification preferences
 *   2. Builds a trade confirmation notification with fill details
 *   3. Dispatches the notification across eligible channels
 *   4. Evaluates active price alerts for the filled symbol
 *   5. Returns outbound Kafka events for notification.sent, notification.failed,
 *      and any alert.triggered events
 *
 * Expected payload shape (from TradingService `trade.executed` / `order.filled`):
 * {
 *   orderId: string,
 *   accountId: string,
 *   customerId: string,
 *   symbol: string,
 *   side: "BUY" | "SELL",
 *   orderType: "MARKET" | "LIMIT" | "STOP" | "STOP_LIMIT",
 *   filledQuantity: number,
 *   remainingQuantity: number,
 *   averageFillPrice: number,
 *   totalValue: number,
 *   commission: number,
 *   fillStatus: "PARTIAL" | "COMPLETE",
 *   executedAt: string (ISO 8601)
 * }
 */

const {
  processTradeConfirmation,
} = require('../services/notification_service');

/**
 * @param {object} payload - Parsed message payload from the order.filled topic
 * @returns {Promise<object[]|null>} Array of { topic, payload } outbound events, or null
 */
async function handle(payload) {
  const {
    orderId,
    accountId,
    customerId,
    symbol,
    side,
    orderType,
    filledQuantity,
    remainingQuantity,
    averageFillPrice,
    totalValue,
    commission,
    fillStatus,
    executedAt,
  } = payload;

  if (!customerId) {
    console.warn('[order-filled] Missing customerId in payload — cannot deliver notification', { orderId });
    return null;
  }

  if (!accountId || !symbol || !side) {
    console.warn('[order-filled] Incomplete order payload — skipping notification', { orderId, accountId, symbol, side });
    return null;
  }

  console.log(`[order-filled] Processing trade confirmation for customer ${customerId}, order ${orderId} — ${side} ${filledQuantity} ${symbol} @ ${averageFillPrice}`);

  const { sentEvents, failedEvents, alertTriggeredEvents } = processTradeConfirmation({
    orderId,
    accountId,
    customerId,
    symbol,
    side,
    orderType: orderType || 'MARKET',
    filledQuantity: filledQuantity || 0,
    remainingQuantity: remainingQuantity || 0,
    averageFillPrice: averageFillPrice || 0,
    totalValue: totalValue || 0,
    commission: commission || 0,
    fillStatus: fillStatus || 'COMPLETE',
    executedAt: executedAt || new Date().toISOString(),
  });

  const outboundEvents = [
    ...sentEvents,
    ...failedEvents,
    ...alertTriggeredEvents,
  ];

  if (outboundEvents.length === 0) {
    console.log(`[order-filled] No outbound events generated for order ${orderId} (quiet hours or no channels)`);
    return null;
  }

  console.log(`[order-filled] Emitting ${outboundEvents.length} event(s) for order ${orderId}`);
  return outboundEvents;
}

module.exports = handle;
