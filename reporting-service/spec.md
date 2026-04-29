# ReportingService — Service Specification

## Purpose

ReportingService owns account statements, trade confirmations, portfolio analytics, and regulatory compliance reporting for the Stock Trading ecosystem. It aggregates data from dependent services to produce structured, delivery-ready reports for customers, internal teams, and regulators.

## Tech Stack

- **Runtime:** Node.js 20
- **Framework:** Express 4
- **Validation:** express-validator
- **Archetype:** HTTP — standard REST service with domain routes and business logic

---

## API Endpoints

| Method | Path | Description | Request Body | Response Shape |
|--------|------|-------------|--------------|----------------|
| POST | /reports/statements | Generate account statements for specified date ranges | `{ accountId, startDate, endDate, format? }` | `{ reportId, accountId, startDate, endDate, status, generatedAt, downloadUrl }` |
| POST | /reports/trade-confirmations | Create trade confirmation reports for executed orders | `{ accountId, tradeIds?, startDate?, endDate?, format? }` | `{ reportId, accountId, tradeCount, status, generatedAt, downloadUrl }` |
| GET | /accounts/{accountId}/performance | Generate portfolio performance analytics and benchmarking | — | `{ accountId, performancePeriod, totalReturn, annualizedReturn, benchmark, alpha, beta, sharpeRatio, positions }` |
| GET | /accounts/{accountId}/position-summary | Create position and holdings summary reports | — | `{ accountId, asOf, totalMarketValue, totalCostBasis, unrealizedPnl, positions[] }` |
| POST | /reports/margin-utilization | Generate margin and buying power utilization reports | `{ accountId, startDate, endDate, format? }` | `{ reportId, accountId, averageUtilization, peakUtilization, marginCallCount, status, generatedAt }` |
| POST | /reports/regulatory | Create regulatory compliance and filing reports | `{ reportType, accountId?, startDate, endDate, jurisdiction?, format? }` | `{ reportId, reportType, jurisdiction, status, filedAt, generatedAt, downloadUrl }` |
| POST | /reports/schedule | Schedule automated report generation and delivery | `{ reportType, accountId, frequency, deliveryChannel, deliveryAddress, startDate?, format? }` | `{ scheduleId, reportType, accountId, frequency, deliveryChannel, nextRunAt, status }` |
| GET | /health | Health check | — | `{ ok: true, service: "reporting-service" }` |

---

## Events Produced

| Topic | Trigger | Payload Shape |
|-------|---------|---------------|
| report.generated | Any report is successfully created | `{ reportId, reportType, accountId, generatedAt, format, sizeBytes }` |
| report.delivered | Report is sent to customer or regulator | `{ reportId, reportType, accountId, deliveredAt, deliveryChannel, recipient }` |
| statement.published | Periodic account statement generation | `{ reportId, accountId, statementPeriod, startDate, endDate, publishedAt }` |
| confirmation.sent | Trade execution confirmation delivery | `{ reportId, accountId, tradeId, confirmedAt, deliveryChannel }` |

---

## Events Consumed

_None_

---

## Dependencies

| Service | ID | Rationale |
|---------|----|-----------|
| AccountService | account-service | Retrieve account details, cash balances, and transaction history for statements |
| PortfolioService | portfolio-service | Retrieve positions and P&L data for position summaries and performance reports |
| TradingService | trading-service | Retrieve trade execution history and order details for trade confirmations |
| MarginService | margin-service | Retrieve margin utilization, buying power, and interest data for margin reports |
| DerivativesTradingService | derivatives-trading-service | Retrieve derivative positions and Greeks for comprehensive portfolio analytics |

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| PORT | 8080 | No | HTTP port the service listens on |
| ACCOUNT_SERVICE_URL | http://account-service:8080 | Yes (prod) | Base URL for AccountService |
| PORTFOLIO_SERVICE_URL | http://portfolio-service:8080 | Yes (prod) | Base URL for PortfolioService |
| TRADING_SERVICE_URL | http://trading-service:8080 | Yes (prod) | Base URL for TradingService |
| MARGIN_SERVICE_URL | http://margin-service:8080 | Yes (prod) | Base URL for MarginService |
| DERIVATIVES_SERVICE_URL | http://derivatives-trading-service:8080 | Yes (prod) | Base URL for DerivativesTradingService |
| EVENT_BUS_URL | http://event-bus:4000 | No | URL for publishing domain events |
| NODE_ENV | development | No | Runtime environment |
