/**
 * NotificationService — Business Logic
 *
 * Owns real-time customer notifications, alert management, delivery preferences,
 * and multi-channel communication.
 *
 * Pure functions — no Kafka or HTTP knowledge. All state is in-memory for this
 * implementation; a production version would use a database.
 */

const { v4: uuidv4 } = require('uuid');

// ─── In-memory stores ─────────────────────────────────────────────────────────

/** @type {Map<string, object>} customerId → preferences */
const customerPreferences = new Map([
  [
    'cust-001',
    {
      customerId: 'cust-001',
      channels: { email: true, sms: true, push: true, inApp: true },
      alertTypes: ['order.filled', 'margin.call_triggered', 'risk.limit_breached', 'price_alert'],
      quietHours: { enabled: false, startHour: 22, endHour: 7, timezone: 'America/New_York' },
      email: 'alice@example.com',
      phone: '+12125550101',
      updatedAt: '2024-01-15T09:00:00.000Z',
    },
  ],
  [
    'cust-002',
    {
      customerId: 'cust-002',
      channels: { email: true, sms: false, push: true, inApp: true },
      alertTypes: ['order.filled', 'margin.call_triggered'],
      quietHours: { enabled: true, startHour: 21, endHour: 8, timezone: 'America/Chicago' },
      email: 'bob@example.com',
      phone: '+13125550202',
      updatedAt: '2024-01-20T14:30:00.000Z',
    },
  ],
]);

/** @type {Map<string, object>} notificationId → notification record */
const notificationHistory = new Map();

/** @type {Map<string, object>} alertId → alert rule */
const alertRules = new Map([
  [
    'alert-001',
    {
      alertId: 'alert-001',
      customerId: 'cust-001',
      accountId: 'acct-1001',
      alertType: 'price_above',
      symbol: 'AAPL',
      condition: 'price_above',
      threshold: 200.00,
      channels: ['email', 'push'],
      status: 'active',
      createdAt: '2024-02-01T10:00:00.000Z',
    },
  ],
  [
    'alert-002',
    {
      alertId: 'alert-002',
      customerId: 'cust-002',
      accountId: 'acct-1002',
      alertType: 'price_below',
      symbol: 'TSLA',
      condition: 'price_below',
      threshold: 150.00,
      channels: ['email'],
      status: 'active',
      createdAt: '2024-02-05T11:30:00.000Z',
    },
  ],
]);

// ─── Preference helpers ───────────────────────────────────────────────────────

/**
 * Retrieve notification preferences for a customer.
 * Returns sensible defaults when no preferences are configured.
 *
 * @param {string} customerId
 * @returns {object} preferences
 */
function getCustomerPreferences(customerId) {
  if (customerPreferences.has(customerId)) {
    return { ...customerPreferences.get(customerId) };
  }
  // Default preferences for unknown customers
  return {
    customerId,
    channels: { email: true, sms: false, push: false, inApp: true },
    alertTypes: ['order.filled', 'margin.call_triggered', 'risk.limit_breached'],
    quietHours: { enabled: false, startHour: 22, endHour: 7, timezone: 'UTC' },
    email: null,
    phone: null,
    updatedAt: null,
  };
}

/**
 * Update notification preferences for a customer.
 *
 * @param {string} customerId
 * @param {object} updates
 * @returns {{ previous: object, current: object }}
 */
function updateCustomerPreferences(customerId, updates) {
  const previous = getCustomerPreferences(customerId);
  const current = {
    ...previous,
    ...updates,
    customerId,
    updatedAt: new Date().toISOString(),
  };
  customerPreferences.set(customerId, current);
  return { previous, current };
}

/**
 * Determine whether a notification should be suppressed due to quiet hours.
 *
 * @param {object} preferences
 * @param {boolean} urgent - Urgent notifications (e.g. margin calls) bypass quiet hours
 * @returns {boolean}
 */
function isWithinQuietHours(preferences, urgent = false) {
  if (urgent) return false;
  const { quietHours } = preferences;
  if (!quietHours || !quietHours.enabled) return false;

  const now = new Date();
  const hour = now.getUTCHours(); // simplified — production would use timezone-aware check
  const { startHour, endHour } = quietHours;

  if (startHour > endHour) {
    // Overnight window e.g. 22:00–07:00
    return hour >= startHour || hour < endHour;
  }
  return hour >= startHour && hour < endHour;
}

/**
 * Determine the effective delivery channels for a notification.
 *
 * @param {object} preferences
 * @param {string[]} [requestedChannels] - Override channels, e.g. for urgent messages
 * @param {boolean} [urgent=false]
 * @returns {string[]}
 */
function resolveDeliveryChannels(preferences, requestedChannels, urgent = false) {
  const { channels } = preferences;
  const enabled = Object.entries(channels)
    .filter(([, active]) => active)
    .map(([channel]) => channel);

  if (urgent) return enabled; // All channels enabled for urgent

  if (requestedChannels && requestedChannels.length > 0) {
    return requestedChannels.filter((ch) => channels[ch] === true);
  }

  return enabled;
}

// ─── Notification creation & delivery ─────────────────────────────────────────

/**
 * Build and record a trade confirmation notification for a filled order.
 *
 * @param {object} orderFilledPayload
 * @returns {{ notification: object, outboundTopic: string }}
 */
function buildTradeConfirmationNotification(orderFilledPayload) {
  const {
    orderId,
    accountId,
    customerId,
    symbol,
    side,
    filledQuantity,
    averageFillPrice,
    totalValue,
    commission,
    executedAt,
    orderType,
  } = orderFilledPayload;

  const notificationId = uuidv4();
  const now = new Date().toISOString();

  const sideLabel = side === 'BUY' ? 'purchased' : 'sold';
  const subject = `Trade Confirmation: ${side} ${filledQuantity} ${symbol} @ $${averageFillPrice}`;
  const body =
    `Your order has been executed. You ${sideLabel} ${filledQuantity} share(s) of ${symbol} ` +
    `at an average price of $${averageFillPrice} per share. ` +
    `Total trade value: $${totalValue}. Commission: $${commission || 0}. ` +
    `Order ID: ${orderId}. Executed at: ${executedAt || now}.`;

  const notification = {
    notificationId,
    customerId,
    accountId,
    channel: null, // populated at dispatch time
    templateType: 'trade_confirmation',
    subject,
    body,
    metadata: {
      orderId,
      symbol,
      side,
      filledQuantity,
      averageFillPrice,
      totalValue,
      commission,
      orderType,
    },
    status: 'pending',
    sentAt: now,
    deliveredAt: null,
  };

  return notification;
}

/**
 * Build and record a margin call notification.
 *
 * @param {object} marginCallPayload
 * @returns {object} notification
 */
function buildMarginCallNotification(marginCallPayload) {
  const {
    accountId,
    customerId,
    deficiencyAmount,
    currentMarginLevel,
    maintenanceMarginLevel,
    requiredDepositAmount,
    deadline,
    triggeredAt,
  } = marginCallPayload;

  const notificationId = uuidv4();
  const now = new Date().toISOString();
  const deadlineStr = deadline || 'end of business day';

  const subject = `URGENT: Margin Call on Account ${accountId} — Action Required`;
  const body =
    `Your account ${accountId} has fallen below the required maintenance margin level. ` +
    `Current margin level: ${currentMarginLevel}%. Required maintenance level: ${maintenanceMarginLevel}%. ` +
    `Margin deficiency: $${deficiencyAmount}. ` +
    `To resolve this margin call, please deposit at least $${requiredDepositAmount} or reduce your positions ` +
    `by ${deadlineStr}. Failure to act may result in automatic liquidation of positions. ` +
    `Margin call triggered at: ${triggeredAt || now}.`;

  return {
    notificationId,
    customerId,
    accountId,
    channel: null,
    templateType: 'margin_call',
    subject,
    body,
    metadata: {
      deficiencyAmount,
      currentMarginLevel,
      maintenanceMarginLevel,
      requiredDepositAmount,
      deadline,
    },
    status: 'pending',
    sentAt: now,
    deliveredAt: null,
    urgent: true,
  };
}

/**
 * Build a risk limit breach notification.
 *
 * @param {object} riskBreachPayload
 * @returns {object} notification
 */
function buildRiskBreachNotification(riskBreachPayload) {
  const {
    accountId,
    customerId,
    limitType,
    currentValue,
    limitThreshold,
    severity,
    affectedSymbol,
    triggeredAt,
  } = riskBreachPayload;

  const notificationId = uuidv4();
  const now = new Date().toISOString();

  const severityLabel = severity === 'critical' ? 'CRITICAL RISK ALERT' : 'Risk Limit Breached';
  const subject = `${severityLabel}: ${limitType} limit exceeded on account ${accountId}`;
  const body =
    `A risk limit has been breached on your account ${accountId}. ` +
    `Risk type: ${limitType}. ` +
    (affectedSymbol ? `Affected security: ${affectedSymbol}. ` : '') +
    `Current value: ${currentValue}. Configured limit: ${limitThreshold}. ` +
    `Severity: ${severity || 'warning'}. ` +
    `Please review your positions and risk exposure immediately. ` +
    `Breach detected at: ${triggeredAt || now}.`;

  return {
    notificationId,
    customerId,
    accountId,
    channel: null,
    templateType: 'risk_breach',
    subject,
    body,
    metadata: {
      limitType,
      currentValue,
      limitThreshold,
      severity,
      affectedSymbol,
    },
    status: 'pending',
    sentAt: now,
    deliveredAt: null,
    urgent: severity === 'critical',
  };
}

/**
 * Simulate dispatching a notification via a specific channel.
 * In production this would call email/SMS/push provider SDKs.
 *
 * @param {object} notification
 * @param {string} channel - 'email' | 'sms' | 'push' | 'inApp'
 * @param {object} preferences
 * @returns {{ success: boolean, deliveredAt?: string, failureReason?: string }}
 */
function dispatchNotification(notification, channel, preferences) {
  // Simulate delivery — in production, call real provider APIs here
  const canDeliver =
    (channel === 'email' && preferences.email) ||
    (channel === 'sms' && preferences.phone) ||
    channel === 'push' ||
    channel === 'inApp';

  if (!canDeliver) {
    return {
      success: false,
      failureReason: `No ${channel} contact information available for customer ${notification.customerId}`,
    };
  }

  // Simulate occasional delivery failures (5% rate) — remove in production
  const simulatedFailure = Math.random() < 0.05;
  if (simulatedFailure) {
    return {
      success: false,
      failureReason: `${channel} delivery provider returned a transient error`,
    };
  }

  return {
    success: true,
    deliveredAt: new Date().toISOString(),
  };
}

/**
 * Persist a notification record to in-memory history.
 *
 * @param {object} notification
 */
function recordNotification(notification) {
  notificationHistory.set(notification.notificationId, {
    ...notification,
    recordedAt: new Date().toISOString(),
  });
}

/**
 * Get notification history for a customer.
 *
 * @param {string} customerId
 * @returns {object[]}
 */
function getNotificationHistory(customerId) {
  return Array.from(notificationHistory.values())
    .filter((n) => n.customerId === customerId)
    .sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt));
}

// ─── Alert management ─────────────────────────────────────────────────────────

/**
 * Create a new alert rule.
 *
 * @param {object} alertData
 * @returns {object} created alert
 */
function createAlert(alertData) {
  const alertId = uuidv4();
  const alert = {
    alertId,
    customerId: alertData.customerId,
    accountId: alertData.accountId || null,
    alertType: alertData.alertType,
    symbol: alertData.symbol || null,
    condition: alertData.condition,
    threshold: alertData.threshold,
    channels: alertData.channels || ['email'],
    status: 'active',
    createdAt: new Date().toISOString(),
    lastCheckedAt: null,
    lastTriggeredAt: null,
  };
  alertRules.set(alertId, alert);
  return { ...alert };
}

/**
 * Get all active alerts for a customer.
 *
 * @param {string} customerId
 * @returns {object[]}
 */
function getActiveAlertsForCustomer(customerId) {
  return Array.from(alertRules.values())
    .filter((a) => a.customerId === customerId && a.status === 'active');
}

/**
 * Cancel an alert rule.
 *
 * @param {string} alertId
 * @returns {object|null} cancelled alert or null if not found
 */
function cancelAlert(alertId) {
  const alert = alertRules.get(alertId);
  if (!alert) return null;
  const updated = { ...alert, status: 'cancelled', cancelledAt: new Date().toISOString() };
  alertRules.set(alertId, updated);
  return updated;
}

/**
 * Evaluate active price alerts against a newly reported price for a symbol.
 * Returns any alert rules that have been triggered.
 *
 * @param {string} symbol
 * @param {number} currentPrice
 * @returns {object[]} triggered alerts
 */
function evaluatePriceAlerts(symbol, currentPrice) {
  const triggered = [];
  const now = new Date().toISOString();

  for (const [alertId, alert] of alertRules.entries()) {
    if (alert.status !== 'active' || alert.symbol !== symbol) continue;

    let conditionMet = false;
    if (alert.condition === 'price_above' && currentPrice >= alert.threshold) {
      conditionMet = true;
    } else if (alert.condition === 'price_below' && currentPrice <= alert.threshold) {
      conditionMet = true;
    } else if (alert.condition === 'price_change_pct') {
      // Requires prior price context — simplified here
      conditionMet = false;
    }

    if (conditionMet) {
      const updated = { ...alert, lastTriggeredAt: now };
      alertRules.set(alertId, updated);
      triggered.push({ ...updated, currentValue: currentPrice });
    }
  }

  return triggered;
}

// ─── High-level orchestration ─────────────────────────────────────────────────

/**
 * Process a trade confirmation and attempt multi-channel delivery.
 * Returns arrays of successfully sent and failed notification events.
 *
 * @param {object} orderFilledPayload
 * @returns {{ sentEvents: object[], failedEvents: object[], alertTriggeredEvents: object[] }}
 */
function processTradeConfirmation(orderFilledPayload) {
  const { customerId, symbol, averageFillPrice } = orderFilledPayload;
  const preferences = getCustomerPreferences(customerId);
  const notification = buildTradeConfirmationNotification(orderFilledPayload);

  const sentEvents = [];
  const failedEvents = [];

  if (!isWithinQuietHours(preferences, false)) {
    const channels = resolveDeliveryChannels(preferences);
    for (const channel of channels) {
      const result = dispatchNotification(notification, channel, preferences);
      const record = {
        ...notification,
        channel,
        status: result.success ? 'delivered' : 'failed',
        deliveredAt: result.deliveredAt || null,
      };
      recordNotification(record);

      if (result.success) {
        sentEvents.push({
          topic: 'notification.sent',
          payload: {
            notificationId: notification.notificationId,
            customerId,
            channel,
            subject: notification.subject,
            templateType: notification.templateType,
            referenceId: orderFilledPayload.orderId,
            referenceType: 'order',
            sentAt: notification.sentAt,
            deliveredAt: result.deliveredAt,
          },
        });
      } else {
        failedEvents.push({
          topic: 'notification.failed',
          payload: {
            notificationId: notification.notificationId,
            customerId,
            channel,
            subject: notification.subject,
            referenceId: orderFilledPayload.orderId,
            referenceType: 'order',
            failureReason: result.failureReason,
            attemptCount: 1,
            failedAt: new Date().toISOString(),
          },
        });
      }
    }
  }

  // Evaluate price alerts triggered by the fill price
  const alertTriggeredEvents = [];
  if (symbol && averageFillPrice) {
    const triggeredAlerts = evaluatePriceAlerts(symbol, averageFillPrice);
    for (const alert of triggeredAlerts) {
      alertTriggeredEvents.push({
        topic: 'alert.triggered',
        payload: {
          alertId: alert.alertId,
          customerId: alert.customerId,
          alertType: alert.alertType,
          symbol: alert.symbol,
          condition: alert.condition,
          threshold: alert.threshold,
          currentValue: alert.currentValue,
          accountId: alert.accountId,
          triggeredAt: alert.lastTriggeredAt,
        },
      });
    }
  }

  return { sentEvents, failedEvents, alertTriggeredEvents };
}

/**
 * Process a margin call event and attempt urgent multi-channel delivery.
 *
 * @param {object} marginCallPayload
 * @returns {{ sentEvents: object[], failedEvents: object[] }}
 */
function processMarginCallNotification(marginCallPayload) {
  const { customerId } = marginCallPayload;
  const preferences = getCustomerPreferences(customerId);
  const notification = buildMarginCallNotification(marginCallPayload);

  const sentEvents = [];
  const failedEvents = [];

  // Margin calls are urgent — bypass quiet hours, use all channels
  const channels = resolveDeliveryChannels(preferences, null, true);

  for (const channel of channels) {
    const result = dispatchNotification(notification, channel, preferences);
    const record = {
      ...notification,
      channel,
      status: result.success ? 'delivered' : 'failed',
      deliveredAt: result.deliveredAt || null,
    };
    recordNotification(record);

    if (result.success) {
      sentEvents.push({
        topic: 'notification.sent',
        payload: {
          notificationId: notification.notificationId,
          customerId,
          channel,
          subject: notification.subject,
          templateType: notification.templateType,
          referenceId: marginCallPayload.accountId,
          referenceType: 'margin_call',
          sentAt: notification.sentAt,
          deliveredAt: result.deliveredAt,
        },
      });
    } else {
      failedEvents.push({
        topic: 'notification.failed',
        payload: {
          notificationId: notification.notificationId,
          customerId,
          channel,
          subject: notification.subject,
          referenceId: marginCallPayload.accountId,
          referenceType: 'margin_call',
          failureReason: result.failureReason,
          attemptCount: 1,
          failedAt: new Date().toISOString(),
        },
      });
    }
  }

  return { sentEvents, failedEvents };
}

/**
 * Process a risk limit breach event and attempt delivery.
 *
 * @param {object} riskBreachPayload
 * @returns {{ sentEvents: object[], failedEvents: object[] }}
 */
function processRiskBreachNotification(riskBreachPayload) {
  const { customerId, severity } = riskBreachPayload;
  const preferences = getCustomerPreferences(customerId);
  const notification = buildRiskBreachNotification(riskBreachPayload);
  const urgent = severity === 'critical';

  const sentEvents = [];
  const failedEvents = [];

  if (!isWithinQuietHours(preferences, urgent)) {
    const channels = resolveDeliveryChannels(preferences, null, urgent);

    for (const channel of channels) {
      const result = dispatchNotification(notification, channel, preferences);
      const record = {
        ...notification,
        channel,
        status: result.success ? 'delivered' : 'failed',
        deliveredAt: result.deliveredAt || null,
      };
      recordNotification(record);

      if (result.success) {
        sentEvents.push({
          topic: 'notification.sent',
          payload: {
            notificationId: notification.notificationId,
            customerId,
            channel,
            subject: notification.subject,
            templateType: notification.templateType,
            referenceId: riskBreachPayload.accountId,
            referenceType: 'risk_breach',
            sentAt: notification.sentAt,
            deliveredAt: result.deliveredAt,
          },
        });
      } else {
        failedEvents.push({
          topic: 'notification.failed',
          payload: {
            notificationId: notification.notificationId,
            customerId,
            channel,
            subject: notification.subject,
            referenceId: riskBreachPayload.accountId,
            referenceType: 'risk_breach',
            failureReason: result.failureReason,
            attemptCount: 1,
            failedAt: new Date().toISOString(),
          },
        });
      }
    }
  }

  return { sentEvents, failedEvents };
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Preferences
  getCustomerPreferences,
  updateCustomerPreferences,
  isWithinQuietHours,
  resolveDeliveryChannels,

  // Notification building & dispatch
  buildTradeConfirmationNotification,
  buildMarginCallNotification,
  buildRiskBreachNotification,
  dispatchNotification,
  recordNotification,
  getNotificationHistory,

  // Alert management
  createAlert,
  getActiveAlertsForCustomer,
  cancelAlert,
  evaluatePriceAlerts,

  // High-level orchestration
  processTradeConfirmation,
  processMarginCallNotification,
  processRiskBreachNotification,
};
