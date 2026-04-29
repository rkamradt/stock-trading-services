# RiskManagementService — Service Specification

## Purpose

The RiskManagementService owns real-time portfolio risk monitoring, pre-trade risk checks, position limits enforcement, and regulatory compliance oversight. It acts as the gatekeeper for all trading activity by validating proposed trades against configured risk thresholds, calculating portfolio Value at Risk (VaR), running stress tests, and surfacing compliance exposure data. When risk limits are breached or circuit breakers are triggered, this service emits events consumed by downstream notification and compliance systems.

## Tech Stack

- **Runtime:** Node.js >= 20
- **Framework:** Express 4
- **Validation:** express-validator
- **Logging:** morgan (combined format)
- **CORS:** cors
- **ID generation:** uuid
- **Archetype:** HTTP — standard REST service with domain routes and business logic

---

## API Endpoints

### POST /trades/risk-check
Validate a proposed trade against all applicable risk limits before execution.

**Request Body:**
```json
{
  "accountId": "string (required)",
  "symbol": "string (required)",
  "orderType": "string (required) — BUY | SELL | BUY_SHORT | BUY_TO_COVER",
  "assetClass": "string (required) — EQUITY | OPTION | FUTURE | ETF",
  "quantity": "number (required, > 0)",
  "limitPrice": "number (optional)",
  "estimatedNotional": "number (required)"
}
```

**Response 200 — Trade Approved:**
```json
{
  "checkId": "uuid",
  "accountId": "string",
  "symbol": "string",
  "approved": true,
  "riskScore": 42,
  "checksPerformed": ["POSITION_LIMIT", "CONCENTRATION", "BUYING_POWER", "VOLATILITY"],
  "warnings": [],
  "timestamp": "ISO8601"
}
```

**Response 200 — Trade Rejected:**
```json
{
  "checkId": "uuid",
  "accountId": "string",
  "symbol": "string",
  "approved": false,
  "riskScore": 95,
  "checksPerformed": ["POSITION_LIMIT", "CONCENTRATION", "BUYING_POWER", "VOLATILITY"],
  "rejectionReasons": ["POSITION_LIMIT_EXCEEDED", "CONCENTRATION_BREACH"],
  "warnings": [],
  "timestamp": "ISO8601"
}
```

---

### GET /accounts/:accountId/risk-metrics
Retrieve current risk metrics and exposure summary for a given brokerage account.

**Path Parameters:**
- `accountId` (string, required)

**Response 200:**
```json
{
  "accountId": "string",
  "riskScore": 65,
  "portfolioBeta": 1.12,
  "sharpeRatio": 1.45,
  "maxDrawdown": -0.08,
  "dailyVaR": 4500.00,
  "concentrationRisk": {
    "topHoldingPct": 0.22,
    "sectorConcentrations": {
      "TECHNOLOGY": 0.45,
      "HEALTHCARE": 0.20
    }
  },
  "leverageRatio": 1.35,
  "openRiskLimitBreaches": 0,
  "lastCalculatedAt": "ISO8601"
}
```

---

### PUT /accounts/:accountId/risk-limits
Set or update the risk limits and thresholds for a brokerage account.

**Path Parameters:**
- `accountId` (string, required)

**Request Body:**
```json
{
  "maxPositionSizePct": 0.25,
  "maxSectorConcentrationPct": 0.40,
  "maxLeverageRatio": 2.0,
  "dailyLossLimit": 10000.00,
  "maxDrawdownPct": 0.15,
  "maxOpenOrders": 50,
  "allowedAssetClasses": ["EQUITY", "OPTION", "ETF"],
  "maxSingleOrderNotional": 500000.00
}
```

**Response 200:**
```json
{
  "accountId": "string",
  "riskLimits": { "...same as request body..." },
  "updatedAt": "ISO8601",
  "updatedBy": "system"
}
```

---

### GET /portfolios/:portfolioId/var
Calculate Value at Risk (VaR) for a portfolio using historical simulation.

**Path Parameters:**
- `portfolioId` (string, required)

**Query Parameters:**
- `confidenceLevel` (number, optional, default: 0.95) — e.g. 0.95 for 95% VaR
- `horizon` (integer, optional, default: 1) — holding period in days

**Response 200:**
```json
{
  "portfolioId": "string",
  "confidenceLevel": 0.95,
  "horizonDays": 1,
  "varAmount": 12500.00,
  "varPct": 0.025,
  "cVaR": 18000.00,
  "methodology": "HISTORICAL_SIMULATION",
  "lookbackDays": 252,
  "calculatedAt": "ISO8601"
}
```

---

### POST /stress-tests
Run one or more stress testing scenarios against a portfolio's current positions.

**Request Body:**
```json
{
  "portfolioId": "string (required)",
  "accountId": "string (required)",
  "scenarios": [
    {
      "scenarioName": "string",
      "equityShock": -0.20,
      "interestRateShock": 0.01,
      "volatilityShock": 0.30,
      "creditSpreadShock": 0.005
    }
  ]
}
```

**Response 200:**
```json
{
  "stressTestId": "uuid",
  "portfolioId": "string",
  "accountId": "string",
  "results": [
    {
      "scenarioName": "string",
      "estimatedPnL": -45000.00,
      "pnlPct": -0.09,
      "breachesRiskLimits": true,
      "breachedLimits": ["MAX_DRAWDOWN"]
    }
  ],
  "worstCaseScenario": "string",
  "worstCaseLoss": -45000.00,
  "executedAt": "ISO8601"
}
```

---

### GET /compliance/exposures
Retrieve aggregated regulatory exposure data across all accounts and instruments.

**Query Parameters:**
- `assetClass` (string, optional) — filter by asset class
- `reportDate` (string, optional) — ISO date for point-in-time report

**Response 200:**
```json
{
  "reportDate": "ISO8601",
  "totalAUM": 125000000.00,
  "exposures": [
    {
      "assetClass": "EQUITY",
      "grossExposure": 80000000.00,
      "netExposure": 72000000.00,
      "numberOfAccounts": 1450,
      "regulatoryLimit": 200000000.00,
      "utilizationPct": 0.40
    }
  ],
  "largeTraderThresholdBreaches": 3,
  "concentrationWarnings": 12,
  "generatedAt": "ISO8601"
}
```

---

### GET /alerts/risk-breaches
Retrieve all currently active risk limit violations and warnings across the platform.

**Query Parameters:**
- `accountId` (string, optional) — filter by account
- `severity` (string, optional) — CRITICAL | HIGH | MEDIUM | LOW
- `status` (string, optional) — ACTIVE | ACKNOWLEDGED | RESOLVED

**Response 200:**
```json
{
  "breaches": [
    {
      "breachId": "uuid",
      "accountId": "string",
      "breachType": "POSITION_LIMIT_EXCEEDED",
      "severity": "HIGH",
      "limitName": "maxPositionSizePct",
      "limitValue": 0.25,
      "currentValue": 0.31,
      "symbol": "AAPL",
      "status": "ACTIVE",
      "detectedAt": "ISO8601",
      "acknowledgedAt": null
    }
  ],
  "totalActive": 1,
  "totalCritical": 0,
  "asOf": "ISO8601"
}
```

---

## Events Produced

| Topic | Trigger | Payload Shape |
|-------|---------|---------------|
| `risk.limit_breached` | Positions exceed configured risk thresholds | `{ eventId, accountId, breachType, limitName, limitValue, currentValue, symbol, severity, detectedAt }` |
| `risk.circuit_breaker_triggered` | A trade is blocked due to risk controls | `{ eventId, accountId, checkId, symbol, orderType, quantity, rejectionReasons, triggeredAt }` |
| `risk.exposure_warning` | Concentration limits are being approached | `{ eventId, accountId, warningType, currentConcentration, thresholdPct, affectedSymbol, issuedAt }` |
| `risk.compliance_alert` | Regulatory reporting requirements or suspicious activity | `{ eventId, alertType, description, affectedEntities, regulatoryBody, filedAt }` |

## Events Consumed

_None — this service does not consume any events._

---

## Dependencies and Rationale

| Service | Dependency Rationale |
|---------|---------------------|
| `account-service` | Retrieve account balances, trading permissions, and account configuration needed for risk checks |
| `portfolio-service` | Fetch real-time position data and P&L for VaR and concentration calculations |
| `trading-service` | Access open order data and trade history for exposure and limit analysis |
| `derivatives-trading-service` | Assess Greeks (delta, gamma, vega) and notional risk of derivative positions |
| `margin-service` | Validate margin requirements and leverage constraints during pre-trade risk checks |

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `8080` | No | Port for the HTTP server |
| `NODE_ENV` | `development` | No | Runtime environment |
| `ACCOUNT_SERVICE_URL` | `http://account-service:8080` | Yes | Base URL for AccountService |
| `PORTFOLIO_SERVICE_URL` | `http://portfolio-service:8080` | Yes | Base URL for PortfolioService |
| `TRADING_SERVICE_URL` | `http://trading-service:8080` | Yes | Base URL for TradingService |
| `DERIVATIVES_SERVICE_URL` | `http://derivatives-trading-service:8080` | Yes | Base URL for DerivativesTradingService |
| `MARGIN_SERVICE_URL` | `http://margin-service:8080` | Yes | Base URL for MarginService |
