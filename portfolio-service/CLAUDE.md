# PortfolioService — Claude Code Context

## Role in the Stock Trading Ecosystem

PortfolioService is the authoritative source of truth for all physical stock positions held within brokerage accounts. It tracks how many shares of each security a customer owns, maintains accurate cost basis records (using FIFO accounting), computes realized and unrealized profit and loss, and processes corporate action adjustments such as stock splits, dividends, and spin-offs. No other service should own or mutate raw position data.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | /accounts/{accountId}/positions | Get all stock positions for an account |
| GET | /accounts/{accountId}/positions/{symbol} | Get position details for a specific security |
| GET | /accounts/{accountId}/pnl | Calculate realized and unrealized P&L for the portfolio |
| GET | /accounts/{accountId}/positions/{symbol}/history | Get position history and cost basis details |
| POST | /accounts/{accountId}/positions/{symbol}/corporate-actions | Record corporate action adjustments (splits, dividends, spin-offs) |
| GET | /health | Health check |

## Event Contracts

### Produced

| Topic | Trigger | Key Payload Fields |
|-------|---------|-------------------|
| position.opened | New stock position established for an account | accountId, symbol, quantity, costBasis, openedAt |
| position.updated | Position quantity or cost basis changes | accountId, symbol, quantity, averageCostBasis, updatedAt |
| position.closed | Position fully liquidated | accountId, symbol, realizedPnl, closedAt |
| portfolio.rebalanced | Corporate action affects the portfolio | accountId, symbol, actionType, adjustmentDetails, rebalancedAt |

### Consumed

_(none)_

## Dependencies

| Service | Reason |
|---------|--------|
| account-service | Validates that accounts exist before accepting position mutations |
| market-data-provider | Fetches current market prices to compute unrealized P&L |

## Tech Stack and Environment Variables

**Tech Stack:** Node.js 20, Express 4, in-memory data store (no external database required for current implementation)

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8080 | HTTP port the service listens on |
| ACCOUNT_SERVICE_URL | http://account-service:8080 | Base URL for AccountService |
| MARKET_DATA_PROVIDER_URL | http://market-data-provider:8080 | Base URL for MarketDataProvider |
| EVENT_BUS_URL | (optional) | URL for publishing domain events |
| LOG_LEVEL | combined | Morgan log format |

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
