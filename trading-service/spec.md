# TradingService — Service Specification

## Purpose

TradingService owns the full trade order lifecycle within the Stock Trading platform. It accepts order submissions from clients (or upstream services), validates them, simulates execution against real-time market prices, tracks fills, and emits events consumed by downstream services such as PortfolioService, SettlementProvider, and NotificationService. It manages multiple order types (market, limit, stop, stop-limit), supports partial fills, order cancellations, and modifications, and maintains a comprehensive audit trail of all executions.

## Tech Stack

- **Runtime:** Node.js 20
- **Framework:** Express 4
- **Validation:** express-validator
- **ID generation:** uuid v4
- **Archetype:** HTTP — standard REST service with domain routes and business logic

---

## API Endpoints

| Method | Path | Description | Request Body | Response Shape |
|--------|------|-------------|-------------|----------------|
| POST | /orders | Submit a new trade order | `{ accountId, symbol, side, orderType, quantity, limitPrice?, stopPrice?, timeInForce?, notes? }` | `201 Order` |
| GET | /orders/:orderId | Get order status and fill details | — | `200 Order` |
| PUT | /orders/:orderId/cancel | Cancel a pending order | `{ cancelReason? }` | `200 Order` |
| PUT | /orders/:orderId/modify | Modify quantity or price of a pending order | `{ quantity?, limitPrice?, stopPrice? }` | `200 Order` |
| GET | /accounts/:accountId/orders | Get all orders for an account | — | `200 Order[]` |
| GET | /accounts/:accountId/trades | Get trade execution history | — | `200 Trade[]` |
| GET | /orders/:orderId/executions | Get detailed execution information for an order | — | `200 Execution[]` |
| GET | /health | Health check | — | `200 { ok: true, service: "trading-service" }` |

### Domain Object Shapes

**Order**
```json
{
  "orderId": "uuid",
  "accountId": "string",
  "symbol": "string",
  "side": "BUY | SELL",
  "orderType": "MARKET | LIMIT | STOP | STOP_LIMIT",
  "quantity": "number",
  "filledQuantity": "number",
  "remainingQuantity": "number",
  "limitPrice": "number | null",
  "stopPrice": "number | null",
  "averageFillPrice": "number | null",
  "status": "PENDING | OPEN | PARTIALLY_FILLED | FILLED | CANCELLED | REJECTED",
  "timeInForce": "DAY | GTC | IOC | FOK",
  "submittedAt": "ISO8601",
  "updatedAt": "ISO8601",
  "filledAt": "ISO8601 | null",
  "cancelledAt": "ISO8601 | null",
  "cancelReason": "string | null",
  "notes": "string | null",
  "executions": "Execution[]"
}
```

**Execution**
```json
{
  "executionId": "uuid",
  "orderId": "uuid",
  "tradeId": "uuid",
  "accountId": "string",
  "symbol": "string",
  "side": "BUY | SELL",
  "executedQuantity": "number",
  "executedPrice": "number",
  "fees": "number",
  "venue": "string",
  "executedAt": "ISO8601"
}
```

**Trade**
```json
{
  "tradeId": "uuid",
  "orderId": "uuid",
  "accountId": "string",
  "symbol": "string",
  "side": "BUY | SELL",
  "executedQuantity": "number",
  "executedPrice": "number",
  "fees": "number",
  "netAmount": "number",
  "venue": "string",
  "executedAt": "ISO8601"
}
```

---

## Events Produced

| Topic | Trigger | Payload Shape |
|-------|---------|---------------|
| order.submitted | A new order is placed and passes initial validation | `{ orderId, accountId, symbol, side, orderType, quantity, limitPrice, stopPrice, timeInForce, submittedAt }` |
| order.filled | An order executes, either partially or completely | `{ orderId, accountId, symbol, side, filledQuantity, remainingQuantity, fillPrice, fillStatus, filledAt }` |
| order.cancelled | An order is cancelled by the user or the system | `{ orderId, accountId, symbol, cancelledAt, cancelReason }` |
| trade.executed | A trade execution completes with full details | `{ tradeId, orderId, accountId, symbol, side, executedQuantity, executedPrice, fees, netAmount, venue, executedAt }` |

---

## Events Consumed

| Topic | Handler | What it Does |
|-------|---------|--------------|
| _(none)_ | — | — |

---

## Dependencies

| Service | ID | Rationale |
|---------|----|-----------|
| AccountService | account-service | Verify the account exists and has appropriate trading permissions before accepting an order |
| MarketDataProvider | market-data-provider | Retrieve real-time quotes used to validate and simulate market-order execution prices |

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| PORT | 8080 | No | HTTP port the service listens on |
| ACCOUNT_SERVICE_URL | http://account-service:8080 | Yes (prod) | Base URL for AccountService |
| MARKET_DATA_URL | http://market-data-provider:8080 | Yes (prod) | Base URL for MarketDataProvider |
| EVENT_BUS_URL | — | No | URL of the message broker for event publishing |
| NODE_ENV | development | No | Runtime environment |
