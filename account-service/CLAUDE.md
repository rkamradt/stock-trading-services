# AccountService — Claude Code Context

## Role in the Stock Trading Ecosystem

AccountService is the authoritative owner of brokerage account data within the Stock Trading platform. It manages the full lifecycle of a customer's brokerage account — from creation through day-to-day balance changes, permission settings, and equity calculations. Other services (e.g. TradingService, MarginService, PortfolioService) rely on this service for account validity, cash balance queries, and permission checks.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| POST | /accounts | Create a new brokerage account for a customer |
| GET | /accounts/:accountId | Retrieve account details and current balances |
| GET | /customers/:customerId/accounts | Get all accounts for a customer |
| PUT | /accounts/:accountId/settings | Update account trading permissions and settings |
| POST | /accounts/:accountId/deposits | Record a cash deposit to the account |
| POST | /accounts/:accountId/withdrawals | Process a cash withdrawal from the account |
| GET | /accounts/:accountId/equity | Calculate total account equity including positions |
| GET | /health | Health check |

## Event Contracts

### Produced
| Topic | Trigger | Key Payload Fields |
|-------|---------|--------------------|
| account.created | New brokerage account successfully opened | accountId, customerId, accountType, status, createdAt |
| account.balance_updated | Cash balance changes (deposit, withdrawal, trade settlement) | accountId, previousBalance, newBalance, changeAmount, reason, timestamp |
| account.status_changed | Account restrictions or permissions change | accountId, previousStatus, newStatus, changedAt, reason |

### Consumed
_None_ — this service does not consume any events.

## Dependencies

| Service | Reason |
|---------|--------|
| customer-management | Validates that a customerId refers to a real, verified customer before opening an account |

## Tech Stack and Environment Variables

**Runtime:** Node.js >= 20, Express 4  
**Validation:** express-validator  
**ID generation:** uuid v4  
**Logging:** morgan (combined)  
**In-memory store:** JavaScript Map objects (no external database required)

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8080 | HTTP port the service listens on |
| CUSTOMER_MANAGEMENT_URL | http://customer-management:8080 | Base URL for the CustomerManagement service |
| EVENT_BUS_URL | (none) | URL of the message broker / event bus for publishing domain events |
| NODE_ENV | development | Runtime environment (development / production / test) |

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
