# RiskManagementService — Claude Code Context

## Role in the Stock Trading Ecosystem

The RiskManagementService is the central risk oversight authority in the Stock Trading platform. It is responsible for real-time portfolio risk monitoring, pre-trade risk checks, position limits enforcement, and regulatory compliance oversight. Every proposed trade in the ecosystem can be validated here before execution. This service provides the safety net that prevents accounts from breaching risk thresholds, concentration limits, and regulatory requirements.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| POST | /trades/risk-check | Validate a proposed trade against risk limits |
| GET | /accounts/:accountId/risk-metrics | Get current risk metrics and exposures for an account |
| PUT | /accounts/:accountId/risk-limits | Set or update risk limits and thresholds |
| GET | /portfolios/:portfolioId/var | Calculate Value at Risk for a portfolio |
| POST | /stress-tests | Run stress testing scenarios against positions |
| GET | /compliance/exposures | Get regulatory exposure reporting data |
| GET | /alerts/risk-breaches | Get current risk limit violations and warnings |
| GET | /health | Health check endpoint |

## Event Contracts

### Produced Events

| Topic | Trigger |
|-------|---------|
| `risk.limit_breached` | Emitted when positions exceed configured risk thresholds |
| `risk.circuit_breaker_triggered` | Emitted when a trade is blocked due to risk controls |
| `risk.exposure_warning` | Emitted when concentration limits are being approached |
| `risk.compliance_alert` | Emitted for regulatory reporting requirements and suspicious activity |

### Consumed Events

_None — this service does not consume any events._

## Dependencies

| Service | Reason |
|---------|--------|
| `account-service` | Retrieve account details, balances, and trading permissions |
| `portfolio-service` | Fetch current positions and P&L for risk calculations |
| `trading-service` | Validate orders against execution risk rules |
| `derivatives-trading-service` | Assess derivative position risk and Greeks exposure |
| `margin-service` | Check margin requirements and buying power for leverage risk |

## Tech Stack and Environment Variables

**Tech Stack:** Node.js (>=20), Express, express-validator, morgan, cors, uuid

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Port the HTTP server listens on |
| `ACCOUNT_SERVICE_URL` | `http://account-service:8080` | Base URL for AccountService |
| `PORTFOLIO_SERVICE_URL` | `http://portfolio-service:8080` | Base URL for PortfolioService |
| `TRADING_SERVICE_URL` | `http://trading-service:8080` | Base URL for TradingService |
| `DERIVATIVES_SERVICE_URL` | `http://derivatives-trading-service:8080` | Base URL for DerivativesTradingService |
| `MARGIN_SERVICE_URL` | `http://margin-service:8080` | Base URL for MarginService |
| `NODE_ENV` | `development` | Runtime environment |

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
