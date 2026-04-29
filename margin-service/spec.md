# MarginService — Service Specification

## Purpose

MarginService owns all margin-related calculations for brokerage accounts. It computes available buying power, enforces initial and maintenance margin requirements, tracks margin calls and deficiency amounts, calculates daily interest on borrowed funds, values collateral with appropriate haircuts, performs pre-trade margin validation, and triggers liquidation processes when accounts breach maintenance thresholds.

## Tech Stack

- **Language / Runtime:** Node.js >= 20
- **Framework:** Express 4
- **Validation:** express-validator
- **Archetype:** HTTP — standard REST service with domain routes and business logic

---

## API Endpoints

| Method | Path | Description | Request Body | Response Shape |
|--------|------|-------------|--------------|----------------|
| GET | `/accounts/{accountId}/buying-power` | Calculate available buying power for margin trades | — | `{ accountId, cashBalance, portfolioMarketValue, marginDebitBalance, equityValue, initialMarginRequirement, availableBuyingPower, excessEquity, marginMultiplier, accountType, calculatedAt }` |
| GET | `/accounts/{accountId}/margin-requirements` | Get current margin requirements and maintenance levels | — | `{ accountId, portfolioMarketValue, marginDebitBalance, equityValue, initialMarginRequirement, maintenanceMarginRequirement, currentMarginRatio, initialMarginRate, maintenanceMarginRate, isInMarginCall, deficiencyAmount, positions[], calculatedAt }` |
| GET | `/accounts/{accountId}/margin-calls` | Check current margin call status and deficiency amount | — | `{ accountId, isInMarginCall, marginCallId?, callType?, deficiencyAmount, equityValue, maintenanceMarginRequirement, marginCallIssuedAt?, dueDate?, status, calculatedAt }` |
| GET | `/accounts/{accountId}/interest` | Calculate margin interest owed on borrowed funds | — | `{ accountId, marginDebitBalance, annualInterestRate, dailyInterestRate, accruedInterestToday, totalUnpaidInterest, interestPeriodStart, interestPeriodEnd, interestCharges[], calculatedAt }` |
| GET | `/accounts/{accountId}/collateral` | Get collateral values and haircut calculations | — | `{ accountId, positions[], totalMarketValue, totalCollateralValue, weightedHaircutRate, cashCollateral, totalEffectiveCollateral, calculatedAt }` |
| POST | `/accounts/{accountId}/liquidation` | Trigger liquidation process for margin calls | `{ reason, liquidationTargetAmount?, authorizedBy }` | `{ liquidationId, accountId, status, reason, deficiencyAmount, liquidationTargetAmount, positionsToLiquidate[], estimatedProceeds, initiatedAt, expectedCompletionAt }` |
| POST | `/trades/margin-check` | Pre-trade margin requirement validation | `{ accountId, symbol, side, quantity, estimatedPrice, orderType }` | `{ approved, accountId, symbol, side, quantity, estimatedPrice, tradeValue, requiredMargin, availableBuyingPower, marginSufficient, postTradeEquityEstimate, postTradeMarginRatio, warnings[], checkedAt }` |
| GET | `/health` | Health check | — | `{ ok: true, service: "margin-service" }` |

---

## Events Produced

| Topic | Trigger | Payload Shape |
|-------|---------|---------------|
| `margin.call_triggered` | Account equity falls below maintenance margin requirements | `{ eventId, topic, accountId, equityValue, maintenanceMarginRequirement, deficiencyAmount, callType, marginCallId, issuedAt }` |
| `margin.interest_accrued` | Daily scheduled accrual of interest on borrowed funds | `{ eventId, topic, accountId, marginDebitBalance, dailyInterestAmount, annualInterestRate, accruedDate }` |
| `margin.liquidation_required` | Forced selling is required due to unresolved margin deficiency | `{ eventId, topic, accountId, liquidationId, deficiencyAmount, liquidationTargetAmount, positionsToLiquidate[], triggeredAt }` |
| `margin.buying_power_updated` | Available margin buying power changes due to trades, deposits, or market moves | `{ eventId, topic, accountId, previousBuyingPower, newBuyingPower, changeAmount, changeReason, updatedAt }` |

---

## Events Consumed

_None declared._

---

## Dependencies

| Service | ID | Rationale |
|---------|----|-----------|
| AccountService | `account-service` | Retrieve cash balance, account type (cash vs. margin), and account status |
| PortfolioService | `portfolio-service` | Retrieve current positions, quantities, and cost basis for margin calculations |
| MarketDataProvider | `market-data-provider` | Real-time price quotes to value positions and compute current market exposure |

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP listen port |
| `ACCOUNT_SERVICE_URL` | `http://account-service:8080` | Base URL for AccountService |
| `PORTFOLIO_SERVICE_URL` | `http://portfolio-service:8080` | Base URL for PortfolioService |
| `MARKET_DATA_PROVIDER_URL` | `http://market-data-provider:8080` | Base URL for MarketDataProvider |
| `INITIAL_MARGIN_RATE` | `0.50` | Reg T initial margin requirement as a decimal (50%) |
| `MAINTENANCE_MARGIN_RATE` | `0.25` | Maintenance margin requirement as a decimal (25%) |
| `MARGIN_INTEREST_RATE` | `0.085` | Annual margin interest rate as a decimal (8.5%) |
| `NODE_ENV` | `development` | Runtime environment |
