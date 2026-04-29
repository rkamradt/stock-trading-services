# ComplianceService — Service Specification

## Purpose

ComplianceService owns audit trails, regulatory reporting, trade surveillance, and compliance monitoring across all brokerage activities. It acts as the authoritative system for regulatory filings with FINRA and SEC, suspicious activity report (SAR) management, compliance rule enforcement, best execution analysis, large trader position reporting, and real-time trade pattern surveillance.

## Tech Stack

- **Runtime:** Node.js >= 20
- **Framework:** Express
- **Validation:** express-validator
- **Logging:** morgan (combined format)
- **ID Generation:** uuid
- **Storage:** In-memory (suitable for development; replace with persistent store for production)
- **Archetype:** HTTP — standard REST service with domain routes and business logic

---

## API Endpoints

| Method | Path | Description | Request Body | Response Shape |
|--------|------|-------------|--------------|----------------|
| POST | /reports/regulatory | Generate regulatory reports and filings for FINRA, SEC | `{ reportType, regulatoryBody, periodStart, periodEnd, accountIds?, entityIds?, submittedBy }` | `{ reportId, reportType, regulatoryBody, status, periodStart, periodEnd, filedAt, downloadUrl }` |
| GET | /audit-trails/:entityId | Query audit trails and transaction history for compliance review | — | `{ entityId, trails: [{ trailId, action, performedBy, timestamp, resourceType, resourceId, details, ipAddress }] }` |
| GET | /surveillance/patterns | Monitor trade patterns and detect compliance violations | — (query: `?patternType, accountId, fromDate, toDate, status`) | `{ patterns: [{ patternId, patternType, accountId, detectedAt, severity, description, involvedOrders, status }] }` |
| POST | /best-execution/analysis | Analyze and report best execution compliance | `{ accountId, orderId?, tradeId?, symbol, orderType, executedPrice, executedQuantity, marketPriceAtExecution, executionVenue, executionTimestamp }` | `{ analysisId, orderId, symbol, bestExecutionScore, priceImprovement, complianceStatus, findings, analyzedAt }` |
| POST | /large-trader/reports | Generate large trader position reports | `{ accountId, reportingPeriod, reportDate, positions: [{ symbol, quantity, marketValue, transactionVolume }], largeTraderId? }` | `{ reportId, accountId, largeTraderId, reportDate, reportingPeriod, totalMarketValue, totalTransactionVolume, status, filedAt }` |
| POST | /suspicious-activity/reports | File suspicious activity reports (SAR) | `{ subjectEntityId, subjectEntityType, activityType, activityDescription, activityDateStart, activityDateEnd, transactionIds?, amount, currency, filedBy, narrativeSummary }` | `{ sarId, subjectEntityId, activityType, filingStatus, filedAt, referenceNumber, acknowledgmentExpected }` |
| PUT | /rules/:ruleId | Update compliance rule configurations and thresholds | `{ ruleName?, description?, thresholds?, enabled?, severity?, applicableEntityTypes?, updatedBy }` | `{ ruleId, ruleName, description, thresholds, enabled, severity, applicableEntityTypes, updatedAt }` |
| GET | /violations | Get current compliance violations and alerts | — (query: `?accountId, severity, status, fromDate, toDate, ruleId`) | `{ violations: [{ violationId, ruleId, ruleName, entityId, entityType, severity, status, detectedAt, description, evidence }] }` |
| GET | /health | Service health check | — | `{ ok: true, service: "compliance-service" }` |

---

## Events Produced

| Topic | Trigger | Payload Shape |
|-------|---------|---------------|
| compliance.violation_detected | When compliance rules are breached | `{ violationId, ruleId, ruleName, entityId, entityType, severity, detectedAt, description, evidence }` |
| compliance.report_filed | When regulatory reports are submitted to authorities | `{ reportId, reportType, regulatoryBody, periodStart, periodEnd, filedAt, filedBy }` |
| compliance.audit_required | When manual compliance review is needed | `{ auditId, subjectEntityId, subjectEntityType, reason, priority, requestedAt, requestedBy }` |
| compliance.sar_filed | When suspicious activity reports are filed | `{ sarId, subjectEntityId, subjectEntityType, activityType, filedAt, referenceNumber }` |

---

## Events Consumed

_None_ — ComplianceService does not consume events from other services.

---

## Dependencies and Rationale

| Service | Dependency Rationale |
|---------|----------------------|
| customer-management | Retrieve customer identity, KYC/AML status, and personal information for compliance review and SAR filings |
| account-service | Access account details, balances, and history for audit trails and regulatory reports |
| trading-service | Access trade orders and execution history for surveillance, best execution analysis, and regulatory filings |
| portfolio-service | Access position data and cost basis for large trader reporting and portfolio-level compliance checks |
| derivatives-trading-service | Access derivative positions and exercise events for regulatory exposure reporting |
| risk-management-service | Coordinate on risk limit breaches and exposure data to feed into compliance alerts and reports |

---

## Environment Variables

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| PORT | 8080 | No | HTTP port the service listens on |
| CUSTOMER_MANAGEMENT_URL | http://customer-management:8080 | No | Base URL for CustomerManagement service |
| ACCOUNT_SERVICE_URL | http://account-service:8080 | No | Base URL for AccountService |
| TRADING_SERVICE_URL | http://trading-service:8080 | No | Base URL for TradingService |
| PORTFOLIO_SERVICE_URL | http://portfolio-service:8080 | No | Base URL for PortfolioService |
| DERIVATIVES_TRADING_SERVICE_URL | http://derivatives-trading-service:8080 | No | Base URL for DerivativesTradingService |
| RISK_MANAGEMENT_SERVICE_URL | http://risk-management-service:8080 | No | Base URL for RiskManagementService |
| NODE_ENV | development | No | Runtime environment |
