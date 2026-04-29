# MarginService — Claude Code Context

## Role in the Stock Trading Ecosystem

MarginService is a core risk and financing service within the Stock Trading platform. It is the authoritative source for margin account calculations, including buying power, maintenance margin requirements, margin calls, interest accrual on borrowed funds, collateral valuation, and liquidation triggers. It enforces regulatory and firm-level margin rules to protect both the firm and the customer from excess leverage.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | /accounts/{accountId}/buying-power | Calculate available buying power for margin trades |
| GET | /accounts/{accountId}/margin-requirements | Get current margin requirements and maintenance levels |
| GET | /accounts/{accountId}/margin-calls | Check current margin call status and deficiency amount |
| GET | /accounts/{accountId}/interest | Calculate margin interest owed on borrowed funds |
| GET | /accounts/{accountId}/collateral | Get collateral values and haircut calculations |
| POST | /accounts/{accountId}/liquidation | Trigger liquidation process for margin calls |
| POST | /trades/margin-check | Pre-trade margin requirement validation |
| GET | /health | Health check |

## Event Contracts

### Produces

| Topic | Trigger |
|-------|---------|
| `margin.call_triggered` | Account equity falls below maintenance margin requirements |
| `margin.interest_accrued` | Daily scheduled calculation of interest on borrowed funds |
| `margin.liquidation_required` | Forced selling is required due to margin deficiency |
| `margin.buying_power_updated` | Available margin buying power changes |

### Consumes

_None declared._

## Dependencies

| Service | Reason |
|---------|--------|
| account-service | Retrieve account cash balances and account type (margin vs. cash) |
| portfolio-service | Retrieve current stock positions and market values for margin calculations |
| market-data-provider | Real-time quotes to value positions and collateral |

## Tech Stack

- **Runtime:** Node.js >= 20
- **Framework:** Express 4
- **Validation:** express-validator
- **ID generation:** uuid
- **Logging:** morgan (combined)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP port the service listens on |
| `ACCOUNT_SERVICE_URL` | `http://account-service:8080` | Base URL for AccountService |
| `PORTFOLIO_SERVICE_URL` | `http://portfolio-service:8080` | Base URL for PortfolioService |
| `MARKET_DATA_PROVIDER_URL` | `http://market-data-provider:8080` | Base URL for MarketDataProvider |
| `INITIAL_MARGIN_RATE` | `0.50` | Reg T initial margin requirement (50%) |
| `MAINTENANCE_MARGIN_RATE` | `0.25` | Maintenance margin requirement (25%) |
| `MARGIN_INTEREST_RATE` | `0.085` | Annual margin interest rate (8.5%) |
| `NODE_ENV` | `development` | Runtime environment |

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
