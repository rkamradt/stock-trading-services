# Stock Trading — Platform Architecture Context

## Services in this platform

- **CustomerManagement** (`customer-management`) [http] — Owns customer identity, personal information, KYC/AML compliance status, and onboarding workflow
- **MarketDataProvider** (`market-data-provider`) [provider] — Wraps external market data APIs to provide real-time quotes, historical prices, and corporate actions to the ecosystem
- **AccountService** (`account-service`) [http] — Owns customer brokerage accounts, balances, trading permissions, and account-level settings
- **PortfolioService** (`portfolio-service`) [http] — Owns physical stock positions per account, cost basis tracking, and realized/unrealized P&L calculations
- **TradingService** (`trading-service`) [http] — Owns trade order lifecycle, execution, and settlement including order types, fills, and integration with execution venues
- **MarginService** (`margin-service`) [http] — Owns margin account calculations, buying power, margin calls, interest on borrowed funds, and liquidation triggers
- **DerivativesTradingService** (`derivatives-trading-service`) [http] — Owns derivative instrument definitions, options chains, derivative position tracking, Greeks calculations, and exercise/assignment processing
- **RiskManagementService** (`risk-management-service`) [http] — Owns real-time portfolio risk monitoring, pre-trade risk checks, position limits, and regulatory compliance oversight
- **SettlementProvider** (`settlement-provider`) [provider] — Wraps external clearing and settlement networks (DTCC, NSCC) to process trade settlement instructions and status
- **ReportingService** (`reporting-service`) [http] — Owns account statements, trade confirmations, portfolio analytics, and regulatory compliance reporting
- **NotificationService** (`notification-service`) [messaging] — Owns real-time customer notifications, alert management, delivery preferences, and multi-channel communication
- **ComplianceService** (`compliance-service`) [http] — Owns audit trails, regulatory reporting, trade surveillance, and compliance monitoring across all brokerage activities

### Archetype legend

| Archetype   | Description |
|-------------|-------------|
| `http`      | Standard REST service with domain routes and business logic |
| `messaging` | Event-driven service (Kafka consumer/producer, no HTTP domain routes) |
| `provider`  | Wraps a third-party API; publishes translated events; no business logic |
| `adaptor`   | Accepts inbound foreign-format webhooks; publishes translated events; no business logic |

---

## Mono-repo layout

One directory per service, each with its own `Dockerfile` and CI workflow.

```
stock-trading/
├── customer-management/
├── market-data-provider/
├── account-service/
├── portfolio-service/
├── trading-service/
├── margin-service/
├── derivatives-trading-service/
├── risk-management-service/
├── settlement-provider/
├── reporting-service/
├── notification-service/
├── compliance-service/
├── market-data-provider-mock/   ← dev/stage only
├── settlement-provider-mock/    ← dev/stage only
├── ecosystem.json
├── CLAUDE.md
└── README.md
```

### Mock directories (dev/stage only — NOT production)

- `market-data-provider-mock/` — test mock for `market-data-provider`
- `settlement-provider-mock/` — test mock for `settlement-provider`

> ⚠️ Directories ending in `-mock` are test scaffolding — **never deploy them to production**.

---

## Architecture principles

- **No shared databases.** Cross-domain communication via Kafka. Same-domain communication via direct API.
- **Provider and adaptor services contain NO business logic** — they are translation layers only.
- **Business logic lives exclusively in `http` and `messaging` services.**

---

## Three AI operations

| Operation | Description |
|-----------|-------------|
| **Forward** | Scaffold/implement a service from its spec |
| **Reverse** | Walk existing code, reconstruct spec, write back to `spec.md` |
| **Delta**   | `git diff HEAD~1 -- spec.md > spec.diff`, implement only changed sections |

---

## Adding a new service

1. Architect it in ArchitectAI → push updated spec and `ecosystem.json`
2. In the service repo: `claude "Scaffold this service per @../root/CLAUDE.md#<service-id>"`
3. Place the generated service `CLAUDE.md` at the repo root
