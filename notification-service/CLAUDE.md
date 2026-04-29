# NotificationService — Claude Code Context

## Role in the Stock Trading Ecosystem

NotificationService is the real-time communication hub of the Stock Trading platform. It is responsible for owning customer notifications, alert management, delivery preferences, and multi-channel communication. It bridges critical trading events — trade fills, margin calls, and risk breaches — to customers via their preferred delivery channels (email, SMS, push, in-app). It also allows customers to configure custom price and portfolio alerts that are evaluated and triggered by the service.

## API Surface

This service is a **messaging archetype** service. The only HTTP endpoint exposed is `/health`.

> No domain HTTP routes are exposed. All domain logic is event-driven via Kafka.

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness check |

The following administrative/management endpoints are defined in the service specification but are not exposed as domain HTTP routes in the messaging archetype:
- POST /notifications/send
- PUT /customers/{customerId}/preferences
- POST /alerts
- GET /customers/{customerId}/alerts
- GET /notifications/{customerId}/history
- DELETE /alerts/{alertId}

## Event Contracts

### Produces

| Topic | Trigger |
|-------|---------|
| `notification.sent` | Emitted when a message is successfully delivered to a customer |
| `alert.triggered` | Emitted when customer-defined alert conditions are met |
| `notification.failed` | Emitted when message delivery fails |
| `preference.updated` | Emitted when customer changes notification settings |

### Consumes

| Topic | Handler | Purpose |
|-------|---------|---------|
| `order.filled` | `src/handlers/order-filled.js` | Listens for trade confirmations to send to customers |
| `margin.call_triggered` | `src/handlers/margin-call_triggered.js` | Listens for margin calls to alert customers |
| `risk.limit_breached` | `src/handlers/risk-limit_breached.js` | Listens for risk breaches to notify customers |

## Dependencies

| Service | Why |
|---------|-----|
| `customer-management` | Resolve customer contact details, preferences, and KYC status for notification targeting |

## Tech Stack and Environment Variables

**Tech Stack:** Node.js 20, Express, KafkaJS, UUID

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP port the service listens on |
| `KAFKA_BROKERS` | `localhost:9092` | Comma-separated list of Kafka broker addresses |
| `CUSTOMER_MANAGEMENT_URL` | `http://customer-management:8080` | Base URL for the CustomerManagement service |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |

## Archetype Constraints — Messaging service

This service IS responsible for:
- Consuming events from every topic listed in its "consumes" contracts
- Running business logic in response to those events
- Publishing to every topic listed in its "produces" contracts
- Managing its own consumer group offset

This service is NOT responsible for:
- Exposing HTTP domain routes — /health is the only HTTP endpoint
- Owning a persistent authoritative data store
- Wrapping external APIs or accepting foreign-format payloads
