# PortfolioService — Service Specification

## Purpose

PortfolioService owns all physical stock positions held within brokerage accounts in the Stock Trading platform. It is responsible for:

- Tracking share quantities per account and security symbol
- Maintaining cost basis records using FIFO lot accounting
- Calculating realized P&L when positions are reduced or closed
- Calculating unrealized P&L using current market prices from MarketDataProvider
- Processing corporate action adjustments (stock splits, cash dividends, spin-offs)

## Tech Stack

- **Runtime:** Node.js 20
- **Framework:** Express 4
- **Validation:** express-validator
- **Persistence:** In-memory store (suitable for development; replace with a persistent database for production)
- **Archetype:** HTTP — standard REST service with domain routes and business logic

---

## API Endpoints

| Method | Path | Description | Request Body | Response Shape |
|--------|------|-------------|--------------|----------------|
| GET | /accounts/{accountId}/positions | Get all stock positions for an account | — | `{ accountId, positions: [Position] }` |
| GET | /accounts/{accountId}/positions/{symbol} | Get position details for a specific security | — | `Position` |
| GET | /accounts/{accountId}/pnl | Calculate realized and unrealized P&L for the portfolio | — | `{ accountId, realizedPnl, unrealizedPnl, totalPnl, calculatedAt, positions: [PnlEntry] }` |
| GET | /accounts/{accountId}/positions/{symbol}/history | Get position history and cost basis details | — | `{ accountId, symbol, lots: [Lot], transactions: [PositionTransaction] }` |
| POST | /accounts/{accountId}/positions/{symbol}/corporate-actions | Record corporate action adjustments | `CorporateActionRequest` | `{ accountId, symbol, action: CorporateAction, updatedPosition: Position }` |
| GET | /health | Health check | — | `{ ok: true, service: "portfolio-service" }` |

### Data Shapes

#### Position

```json
{
  "positionId": "uuid",
  "accountId": "string",
  "symbol": "string",
  "quantity": 100,
  "averageCostBasis": 145.32,
  "totalCostBasis": 14532.00,
  "currentPrice": 152.10,
  "marketValue": 15210.00,
  "unrealizedPnl": 678.00,
  "unrealizedPnlPercent": 4.67,
  "openedAt": "ISO8601",
  "updatedAt": "ISO8601",
  "status": "open | closed"
}
```

#### Lot

```json
{
  "lotId": "uuid",
  "acquiredAt": "ISO8601",
  "quantity": 50,
  "costBasis": 140.00,
  "remainingQuantity": 50
}
```

#### PositionTransaction

```json
{
  "transactionId": "uuid",
  "type": "buy | sell | split | dividend | spin-off",
  "quantity": 50,
  "price": 140.00,
  "fees": 0.50,
  "realizedPnl": null,
  "executedAt": "ISO8601",
  "notes": "string"
}
```

#### PnlEntry

```json
{
  "symbol": "string",
  "quantity": 100,
  "averageCostBasis": 145.32,
  "currentPrice": 152.10,
  "marketValue": 15210.00,
  "unrealizedPnl": 678.00,
  "unrealizedPnlPercent": 4.67
}
```

#### CorporateActionRequest (POST body)

```json
{
  "actionType": "split | reverse_split | cash_dividend | stock_dividend | spin_off",
  "effectiveDate": "YYYY-MM-DD",
  "splitRatio": 2.0,
  "dividendAmount": 0.88,
  "notes": "string"
}
```

---

## Events Produced

| Topic | Trigger | Payload Shape |
|-------|---------|---------------|
| `position.opened` | New stock position established | `{ eventId, accountId, symbol, quantity, averageCostBasis, totalCostBasis, openedAt }` |
| `position.updated` | Position quantity or cost basis changes | `{ eventId, accountId, symbol, quantity, averageCostBasis, totalCostBasis, updatedAt }` |
| `position.closed` | Position fully liquidated | `{ eventId, accountId, symbol, realizedPnl, closedAt }` |
| `portfolio.rebalanced` | Corporate action affects the portfolio | `{ eventId, accountId, symbol, actionType, adjustmentDetails, rebalancedAt }` |

---

## Events Consumed

_(none)_

---

## Dependencies

| Service | ID | Reason |
|---------|----|--------|
| AccountService | `account-service` | Validate account existence before accepting position operations |
| MarketDataProvider | `market-data-provider` | Fetch real-time prices to compute unrealized P&L |

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `8080` | No | HTTP port for the service |
| `ACCOUNT_SERVICE_URL` | `http://account-service:8080` | Yes (prod) | Base URL for AccountService |
| `MARKET_DATA_PROVIDER_URL` | `http://market-data-provider:8080` | Yes (prod) | Base URL for MarketDataProvider |
| `EVENT_BUS_URL` | — | No | URL for publishing domain events to the event bus |
| `LOG_LEVEL` | `combined` | No | Morgan HTTP log format |
