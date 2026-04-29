# DerivativesTradingService — Service Specification

## Purpose

DerivativesTradingService owns the full lifecycle of derivative instruments within the Stock Trading platform. This includes instrument definitions (options contracts, futures contracts, swaps), options chain retrieval, per-account derivative position tracking, real-time Greek calculations (delta, gamma, theta, vega), and exercise/assignment processing. It integrates with TradingService for order routing, PortfolioService for underlying position data, and MarketDataProvider for real-time pricing inputs needed for Greeks.

## Tech Stack

- **Runtime:** Node.js >= 20
- **Framework:** Express 4
- **Archetype:** HTTP — standard REST service with domain routes and business logic
- **Persistence:** In-memory store (production would use PostgreSQL)

---

## API Endpoints

| Method | Path | Description | Request Body | Response Shape |
|--------|------|-------------|--------------|----------------|
| GET | `/options/chains/:symbol` | Get options chain for an underlying security | — | `{ symbol, underlyingPrice, expirations: [{ expirationDate, calls: [OptionContract], puts: [OptionContract] }] }` |
| POST | `/options/:optionId/exercise` | Exercise an option position | `{ accountId, quantity, exerciseType }` | `{ exerciseId, optionId, accountId, quantity, status, exercisedAt }` |
| POST | `/derivatives/orders` | Submit derivative orders (options, futures, swaps) | `{ accountId, instrumentType, symbol, side, quantity, orderType, limitPrice?, expiration? }` | `{ orderId, accountId, instrumentType, symbol, side, quantity, orderType, status, submittedAt }` |
| GET | `/derivatives/expirations` | Get expiration schedules and assignment notices | — | `{ expirations: [{ derivativeId, symbol, expirationDate, type, assignmentNotices: [] }] }` |
| GET | `/derivatives/:derivativeId/greeks` | Calculate Greeks for a derivative | — | `{ derivativeId, symbol, delta, gamma, theta, vega, rho, impliedVolatility, calculatedAt }` |
| GET | `/accounts/:accountId/derivative-positions` | Get all derivative positions and Greeks for an account | — | `{ accountId, positions: [DerivativePosition] }` |
| POST | `/futures/:futuresId/close` | Close or roll a futures position | `{ accountId, action, quantity, rollToContractId? }` | `{ futuresId, accountId, action, quantity, status, closedAt }` |
| GET | `/health` | Health check | — | `{ ok: true, service: "derivatives-trading-service" }` |

### OptionContract Shape

```json
{
  "contractId": "string",
  "symbol": "string",
  "underlyingSymbol": "string",
  "strikePrice": "number",
  "expirationDate": "string (ISO8601 date)",
  "optionType": "CALL | PUT",
  "bid": "number",
  "ask": "number",
  "lastPrice": "number",
  "volume": "number",
  "openInterest": "number",
  "impliedVolatility": "number",
  "delta": "number",
  "gamma": "number",
  "theta": "number",
  "vega": "number"
}
```

### DerivativePosition Shape

```json
{
  "positionId": "string",
  "accountId": "string",
  "derivativeId": "string",
  "instrumentType": "OPTION | FUTURE | SWAP",
  "symbol": "string",
  "underlyingSymbol": "string",
  "side": "LONG | SHORT",
  "quantity": "number",
  "openPrice": "number",
  "currentPrice": "number",
  "strikePrice": "number (options only)",
  "expirationDate": "string",
  "unrealizedPnl": "number",
  "delta": "number",
  "gamma": "number",
  "theta": "number",
  "vega": "number",
  "openedAt": "string (ISO8601)"
}
```

---

## Events Produced

| Topic | Trigger | Payload Shape |
|-------|---------|---------------|
| `derivative.position_opened` | New derivative position established | `{ eventId, positionId, accountId, derivativeId, instrumentType, symbol, side, quantity, openPrice, openedAt }` |
| `derivative.exercised` | Option exercised by holder | `{ eventId, exerciseId, optionId, accountId, quantity, strikePrice, underlyingSymbol, exercisedAt }` |
| `derivative.assigned` | Option writer receives assignment notice | `{ eventId, assignmentId, optionId, accountId, quantity, strikePrice, underlyingSymbol, assignedAt }` |
| `derivative.expired` | Derivative expires worthless or is cash-settled | `{ eventId, derivativeId, accountId, symbol, expirationDate, settlementValue, expiredAt }` |
| `derivative.greeks_updated` | Risk metrics updated due to market movements | `{ eventId, derivativeId, symbol, delta, gamma, theta, vega, impliedVolatility, updatedAt }` |

## Events Consumed

_(none)_

---

## Dependencies

| Service | ID | Reason |
|---------|----|--------|
| TradingService | `trading-service` | Routes and tracks derivative orders through the execution lifecycle |
| PortfolioService | `portfolio-service` | Reads underlying position data required for exercise/assignment and net exposure |
| MarketDataProvider | `market-data-provider` | Supplies real-time underlying prices for options chain data and Greeks computation |

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `8080` | No | HTTP listen port |
| `TRADING_SERVICE_URL` | `http://trading-service:8080` | Yes (prod) | Base URL for TradingService |
| `PORTFOLIO_SERVICE_URL` | `http://portfolio-service:8080` | Yes (prod) | Base URL for PortfolioService |
| `MARKET_DATA_PROVIDER_URL` | `http://market-data-provider:8080` | Yes (prod) | Base URL for MarketDataProvider |
| `NODE_ENV` | `development` | No | Runtime environment (`development`, `production`, `test`) |
