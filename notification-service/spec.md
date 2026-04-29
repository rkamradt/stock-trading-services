# NotificationService — Service Specification

## Overview

| Property | Value |
|----------|-------|
| **Service ID** | `notification-service` |
| **Purpose** | Owns real-time customer notifications, alert management, delivery preferences, and multi-channel communication |
| **Tech Stack** | Node.js 20, Express, KafkaJS, UUID |
| **Archetype** | Messaging — event-driven, Kafka consumer/producer |

---

## API Endpoints

This service is a **messaging archetype**. The only live HTTP endpoint is `/health`. The domain endpoints below describe the logical interface of the service and are included for specification completeness; they are not exposed as live HTTP routes in the current archetype implementation.

| Method | Path | Description | Request Body | Response Shape |
|--------|------|-------------|--------------|----------------|
| GET | /health | Liveness check | — | `{ ok: true, service: "notification-service" }` |
| POST | /notifications/send | Send immediate notification to a customer | `{ customerId, channel, subject, body, metadata }` | `{ notificationId, status, deliveredAt }` |
| PUT | /customers/{customerId}/preferences | Update notification preferences and delivery channels | `{ channels: { email, sms, push, inApp }, alertTypes, quietHours }` | `{ customerId, preferences, updatedAt }` |
| POST | /alerts | Create price or portfolio alert rule | `{ customerId, accountId, alertType, symbol, condition, threshold, channels }` | `{ alertId, customerId, alertType, status, createdAt }` |
| GET | /customers/{customerId}/alerts | Get active alerts for a customer | — | `{ customerId, alerts: [{ alertId, alertType, symbol, condition, threshold, status, createdAt }] }` |
| GET | /notifications/{customerId}/history | Get notification delivery history | — | `{ customerId, notifications: [{ notificationId, channel, subject, status, sentAt, deliveredAt }] }` |
| DELETE | /alerts/{alertId} | Cancel an active alert | — | `{ alertId, status: "cancelled", cancelledAt }` |

---

## Events Produced

| Topic | Trigger | Payload Shape |
|-------|---------|---------------|
| `notification.sent` | Emitted when a message is successfully delivered to a customer | `{ notificationId, customerId, channel, subject, templateType, referenceId, referenceType, sentAt, deliveredAt }` |
| `alert.triggered` | Emitted when customer-defined alert conditions are met | `{ alertId, customerId, alertType, symbol, condition, threshold, currentValue, accountId, triggeredAt }` |
| `notification.failed` | Emitted when message delivery fails | `{ notificationId, customerId, channel, subject, referenceId, referenceType, failureReason, attemptCount, failedAt }` |
| `preference.updated` | Emitted when customer changes notification settings | `{ customerId, previousPreferences, newPreferences, updatedAt }` |

---

## Events Consumed

| Topic | Handler File | What It Does |
|-------|-------------|--------------|
| `order.filled` | `src/handlers/order-filled.js` | Receives trade fill events from TradingService. Looks up customer and account associated with the order, formats a trade confirmation notification with fill details (symbol, quantity, price, fees, side), delivers it via the customer's preferred channels, and publishes `notification.sent` or `notification.failed`. Also evaluates any active price alerts for the filled symbol. |
| `margin.call_triggered` | `src/handlers/margin-call_triggered.js` | Receives margin call events from MarginService. Identifies the affected customer, formats an urgent margin call notification including deficiency amount and deadline, delivers it via all available channels (overriding quiet hours), and publishes `notification.sent` or `notification.failed`. |
| `risk.limit_breached` | `src/handlers/risk-limit_breached.js` | Receives risk breach events from RiskManagementService. Identifies the affected account and customer, formats a risk alert notification with breach details (limit type, current value, threshold), delivers it via customer's preferred channels, and publishes `notification.sent` or `notification.failed`. |

---

## Dependencies

| Service | ID | Rationale |
|---------|----|-----------|
| CustomerManagement | `customer-management` | Resolve customer contact details (email, phone), delivery preferences, and account status before dispatching notifications |

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `8080` | No | HTTP port the service listens on |
| `KAFKA_BROKERS` | `localhost:9092` | Yes (production) | Comma-separated list of Kafka broker addresses |
| `CUSTOMER_MANAGEMENT_URL` | `http://customer-management:8080` | Yes (production) | Base URL for the CustomerManagement service |
| `NODE_ENV` | `development` | No | Runtime environment (`development`, `production`, `test`) |
| `KAFKA_CLIENT_ID` | `notification-service` | No | Kafka client identifier for this service instance |
| `KAFKA_CONSUMER_GROUP` | `notification-service-group` | No | Kafka consumer group ID for offset management |
