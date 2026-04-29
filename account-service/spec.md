# AccountService — Service Specification

## Purpose

AccountService owns and manages customer brokerage accounts within the Stock Trading ecosystem. It is the single source of truth for account identity, cash balances, trading permissions, account-level settings, and aggregate equity values. All other services that need to know whether an account exists, is funded, or has certain trading permissions must query this service.

## Tech Stack

| Concern | Choice |
|---------|--------|
| Runtime | Node.js >= 20 |
| Framework | Express 4 |
| Validation | express-validator |
| ID generation | uuid v4 |
| HTTP logging | morgan (combined format) |
| Persistence | In-memory (Map) — swap for a database adapter as needed |

## Archetype

**HTTP** — standard REST service with domain routes and business logic.

---

## API Endpoints

| Method | Path | Description | Request Body | Response Shape |
|--------|------|-------------|--------------|----------------|
| POST | /accounts | Create a new brokerage account for a customer | `{ customerId, accountType, currency? }` | `201 Account` |
| GET | /accounts/:accountId | Retrieve account details and current balances | — | `200 Account` |
| GET | /customers/:customerId/accounts | Get all accounts belonging to a customer | — | `200 Account[]` |
| PUT | /accounts/:accountId/settings | Update account trading permissions and settings | `{ tradingPermissions?, marginEnabled?, optionsLevel? }` | `200 Account` |
| POST | /accounts/:accountId/deposits | Record a cash deposit to the account | `{ amount, currency?, reference? }` | `200 { account, transaction }` |
| POST | /accounts/:accountId/withdrawals | Process a cash withdrawal from the account | `{ amount, currency?, reference? }` | `200 { account, transaction }` |
| GET | /accounts/:accountId/equity | Calculate total account equity including positions | — | `200 { accountId, cashBalance, positionsValue, totalEquity, calculatedAt }` |
| GET | /health | Liveness probe | — | `200 { ok: true, service: "account-service" }` |

### Account Object Shape

```json
{
  "accountId": "uuid",
  "customerId": "uuid",
  "accountType": "INDIVIDUAL | JOINT | IRA | MARGIN",
  "status": "PENDING | ACTIVE | RESTRICTED | SUSPENDED | CLOSED",
  "currency": "USD",
  "cashBalance": 10000.00,
  "reservedCash": 0.00,
  "availableCash": 10000.00,
  "settings": {
    "tradingPermissions": ["EQUITIES", "OPTIONS", "FUTURES"],
    "marginEnabled": false,
    "optionsLevel": 0,
    "dayTradingEnabled": false
  },
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### Transaction Object Shape

```json
{
  "transactionId": "uuid",
  "accountId": "uuid",
  "type": "DEPOSIT | WITHDRAWAL",
  "amount": 500.00,
  "currency": "USD",
  "reference": "external-ref-id",
  "balanceBefore": 9500.00,
  "balanceAfter": 10000.00,
  "createdAt": "ISO8601"
}
```

---

## Events Produced

| Topic | Trigger | Payload Shape |
|-------|---------|---------------|
| `account.created` | New brokerage account successfully opened | `{ accountId, customerId, accountType, status, currency, createdAt }` |
| `account.balance_updated` | Cash balance changes due to deposit, withdrawal, or trade settlement | `{ accountId, transactionId, transactionType, previousBalance, newBalance, changeAmount, currency, timestamp }` |
| `account.status_changed` | Account restrictions or permissions change | `{ accountId, previousStatus, newStatus, reason, changedAt }` |

---

## Events Consumed

_None_ — AccountService does not subscribe to any event topics.

---

## Dependencies

| Service | ID | Reason |
|---------|----|--------|
| CustomerManagement | customer-management | Verify customer existence and KYC/AML status before opening an account |

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `8080` | No | HTTP port the Express server listens on |
| `CUSTOMER_MANAGEMENT_URL` | `http://customer-management:8080` | No | Base URL for CustomerManagement service calls |
| `EVENT_BUS_URL` | — | No | URL for publishing domain events to the message broker |
| `NODE_ENV` | `development` | No | Runtime environment flag |
