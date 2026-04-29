# ReportingService — Claude Code Context

## Role in the Stock Trading Ecosystem

ReportingService is the central reporting hub of the Stock Trading platform. It owns account statements, trade confirmations, portfolio analytics, and regulatory compliance reporting. It serves customers, internal operators, and regulators by generating structured reports from data sourced across multiple downstream services.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| POST | /reports/statements | Generate account statements for specified date ranges |
| POST | /reports/trade-confirmations | Create trade confirmation reports for executed orders |
| GET | /accounts/{accountId}/performance | Generate portfolio performance analytics and benchmarking |
| GET | /accounts/{accountId}/position-summary | Create position and holdings summary reports |
| POST | /reports/margin-utilization | Generate margin and buying power utilization reports |
| POST | /reports/regulatory | Create regulatory compliance and filing reports |
| POST | /reports/schedule | Schedule automated report generation and delivery |
| GET | /health | Health check |

## Event Contracts

### Produces

| Topic | Trigger | Description |
|-------|---------|-------------|
| report.generated | Any report is successfully created | Emitted when any report is successfully created |
| report.delivered | Report is sent to customer or regulator | Emitted when report is sent to customer or regulator |
| statement.published | Periodic account statement generation | Emitted for periodic account statements |
| confirmation.sent | Trade execution confirmation delivery | Emitted when trade execution confirmations are delivered |

### Consumes

_None_

## Dependencies

| Service | Reason |
|---------|--------|
| account-service | Retrieve account details, balances, and history for statements |
| portfolio-service | Retrieve positions and P&L data for position summaries and performance reports |
| trading-service | Retrieve trade execution history for confirmations and regulatory reports |
| margin-service | Retrieve margin utilization and interest data for margin reports |
| derivatives-trading-service | Retrieve derivative positions for comprehensive portfolio reports |

## Tech Stack and Environment Variables

**Tech Stack:** Node.js 20, Express 4, express-validator, morgan, cors, uuid

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8080 | HTTP port the service listens on |
| ACCOUNT_SERVICE_URL | http://account-service:8080 | Base URL for AccountService |
| PORTFOLIO_SERVICE_URL | http://portfolio-service:8080 | Base URL for PortfolioService |
| TRADING_SERVICE_URL | http://trading-service:8080 | Base URL for TradingService |
| MARGIN_SERVICE_URL | http://margin-service:8080 | Base URL for MarginService |
| DERIVATIVES_SERVICE_URL | http://derivatives-trading-service:8080 | Base URL for DerivativesTradingService |
| EVENT_BUS_URL | http://event-bus:4000 | URL for publishing domain events |
| NODE_ENV | development | Runtime environment |

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
