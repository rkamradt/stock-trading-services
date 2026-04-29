# DerivativesTradingService — Claude Code Context

## Role in the Stock Trading Ecosystem

DerivativesTradingService is the authoritative service for all derivative instrument activity within the Stock Trading platform. It owns derivative instrument definitions (options, futures, swaps), options chain data, derivative position tracking per account, real-time Greeks calculations (delta, gamma, theta, vega), and the full exercise/assignment lifecycle for options. It serves risk management, portfolio, and trading workflows downstream.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | /options/chains/:symbol | Get options chain for an underlying security |
| POST | /options/:optionId/exercise | Exercise an option position |
| POST | /derivatives/orders | Submit derivative orders (options, futures, swaps) |
| GET | /derivatives/expirations | Get expiration schedules and assignment notices |
| GET | /derivatives/:derivativeId/greeks | Calculate Greeks for a derivative |
| GET | /accounts/:accountId/derivative-positions | Get all derivative positions and Greeks for an account |
| POST | /futures/:futuresId/close | Close or roll a futures position |
| GET | /health | Health check |

## Event Contracts

### Produces
| Topic | Trigger |
|-------|---------|
| `derivative.position_opened` | Emitted when a new derivative position is established |
| `derivative.exercised` | Emitted when an option is exercised, affecting underlying positions |
| `derivative.assigned` | Emitted when an option writer receives assignment notice |
| `derivative.expired` | Emitted when derivative expires worthless or is settled |
| `derivative.greeks_updated` | Emitted when risk metrics change due to market movements |

### Consumes
_(none)_

## Dependencies

| Service | Reason |
|---------|--------|
| trading-service | Order lifecycle, execution, and fill data for derivative orders |
| portfolio-service | Underlying position data needed for exercise/assignment and Greeks |
| market-data-provider | Real-time quotes and underlying prices for Greeks and chain data |

## Tech Stack and Environment Variables

**Tech:** Node.js (>=20) / Express

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP listen port |
| `TRADING_SERVICE_URL` | `http://trading-service:8080` | Base URL for trading-service |
| `PORTFOLIO_SERVICE_URL` | `http://portfolio-service:8080` | Base URL for portfolio-service |
| `MARKET_DATA_PROVIDER_URL` | `http://market-data-provider:8080` | Base URL for market-data-provider |
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
