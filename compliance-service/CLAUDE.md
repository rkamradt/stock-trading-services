# ComplianceService — Claude Code Context

## Role in the Stock Trading Ecosystem

ComplianceService is the central compliance and audit authority within the Stock Trading platform. It owns audit trails, regulatory reporting, trade surveillance, and compliance monitoring across all brokerage activities. It serves as the system of record for regulatory filings (FINRA, SEC), suspicious activity reports (SARs), compliance rule management, trade pattern surveillance, best execution analysis, and large trader reporting. All other services in the ecosystem may be subject to compliance scrutiny that flows through this service.

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| POST | /reports/regulatory | Generate regulatory reports and filings for FINRA, SEC |
| GET | /audit-trails/:entityId | Query audit trails and transaction history for compliance review |
| GET | /surveillance/patterns | Monitor trade patterns and detect compliance violations |
| POST | /best-execution/analysis | Analyze and report best execution compliance |
| POST | /large-trader/reports | Generate large trader position reports |
| POST | /suspicious-activity/reports | File suspicious activity reports (SAR) |
| PUT | /rules/:ruleId | Update compliance rule configurations and thresholds |
| GET | /violations | Get current compliance violations and alerts |
| GET | /health | Health check endpoint |

## Event Contracts

### Produces

| Topic | Trigger | Description |
|-------|---------|-------------|
| compliance.violation_detected | When compliance rules are breached | Emitted with details of the violation, entity, rule, and severity |
| compliance.report_filed | When regulatory reports are submitted to authorities | Emitted with report ID, type, and filing metadata |
| compliance.audit_required | When manual compliance review is needed | Emitted with audit subject, reason, and priority |
| compliance.sar_filed | When suspicious activity reports are filed | Emitted with SAR ID, subject entity, and filing timestamp |

### Consumes

_None_ — This service does not consume events from other services.

## Dependencies

| Service | Purpose |
|---------|---------|
| customer-management | Retrieve customer identity and KYC/AML status for compliance checks |
| account-service | Access account data for audit trails and regulatory reporting |
| trading-service | Access trade history and order data for surveillance and best execution |
| portfolio-service | Access position data for large trader reporting and compliance checks |
| derivatives-trading-service | Access derivative positions for regulatory reporting |
| risk-management-service | Coordinate risk breaches and exposure data for compliance alerts |

## Tech Stack and Environment Variables

**Tech Stack:**
- Runtime: Node.js >= 20
- Framework: Express
- Validation: express-validator
- Logging: morgan
- ID generation: uuid
- Storage: In-memory (no external database required in development)

**Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8080 | HTTP port the service listens on |
| CUSTOMER_MANAGEMENT_URL | http://customer-management:8080 | Base URL for CustomerManagement service |
| ACCOUNT_SERVICE_URL | http://account-service:8080 | Base URL for AccountService |
| TRADING_SERVICE_URL | http://trading-service:8080 | Base URL for TradingService |
| PORTFOLIO_SERVICE_URL | http://portfolio-service:8080 | Base URL for PortfolioService |
| DERIVATIVES_TRADING_SERVICE_URL | http://derivatives-trading-service:8080 | Base URL for DerivativesTradingService |
| RISK_MANAGEMENT_SERVICE_URL | http://risk-management-service:8080 | Base URL for RiskManagementService |
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
