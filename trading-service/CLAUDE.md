# TradingService — Claude Code Context

## Role in the Stock Trading Ecosystem

TradingService is the central order management and execution engine within the Stock Trading platform. It owns the complete trade order lifecycle from submission through execution and settlement. This includes managing various order types (market, limit, stop, stop-limit), tracking order fills (partial and complete), coordinating with execution venues, and maintaining a complete history of all trades executed on behalf of customer accounts. It is a critical path service — every equity trade flows through this service.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| POST   | /orders | Submit a new trade order |
| GET    | /orders/:orderId | Get order status and fill details |
| PUT    | /orders/:orderId/cancel | Cancel a pending order |
| PUT    | /orders/:orderId/modify | Modify quantity or price of a pending order |
| GET    | /accounts/:accountId/orders | Get all orders for an account |
| GET    | /accounts/:accountId/trades | Get trade execution history |
| GET    | /orders/:orderId/executions | Get detailed execution information for an order |
| GET    | /health | Health check |

## Event Contracts

### Produced

| Topic | Trigger | Key Payload Fields |
|-------|---------|-------------------|
| order.submitted | New order placed and validated | orderId, accountId, symbol, side, orderType, quantity, limitPrice, stopPrice, submittedAt |
| order.filled | Order executes (partial or complete) | orderId, accountId, symbol, filledQuantity, remainingQuantity, fillPrice, fillStatus, filledAt |
| order.cancelled | Order cancelled by user or system | orderId, accountId, symbol, cancelledAt, cancelReason |
| trade.executed | Full execution detail | tradeId, orderId, accountId, symbol, side, executedQuantity, executedPrice, fees, executedAt, venue |

### Consumed

_(none)_

## Dependencies

| Service | Purpose |
|---------|---------|
| account-service | Validate that accounts exist and have sufficient permissions/balances before accepting orders |
| market-data-provider | Retrieve real-time quotes for market order price validation and execution simulation |

## Tech Stack and Environment Variables

**Tech Stack:** Node.js 20, Express 4, express-validator, uuid, cors, morgan

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8080 | HTTP port the service listens on |
| ACCOUNT_SERVICE_URL | http://account-service:8080 | Base URL for the AccountService |
| MARKET_DATA_URL | http://market-data-provider:8080 | Base URL for MarketDataProvider |
| EVENT_BUS_URL | (optional) | URL of the event bus / message broker |
| NODE_ENV | development | Runtime environment (development \| production \| test) |

---

## Archetype Constraints — HTTP service

This service IS responsible for:
- Owning and persisting its domain data (in-memory or database)
- Implementing every API endpoint declared in its spec exactly as specified
- Input validation on all mutating endpoints (POST, PUT, PATCH)
- All business logic for its bounded context

This service is NOT responsible for:
- Wrapping external third-party APIs (use a provider service for that)
- Accepting foreign-format payloads (use an adaptor service for that)
- Event-driven processing that is not declared in its event contracts
