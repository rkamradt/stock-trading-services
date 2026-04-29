# CustomerManagement — Claude Code Context

## Role in the Stock Trading Ecosystem

CustomerManagement is the identity and onboarding authority for the Stock Trading platform. It is the single source of truth for customer personal information, Know Your Customer (KYC) verification status, and Anti-Money Laundering (AML) compliance standing. Every other service that needs to validate or reference a customer identity depends on this service. It drives the onboarding workflow from initial registration through KYC approval to full account eligibility.

## API Surface

| Method | Path                                      | Description                                          |
|--------|-------------------------------------------|------------------------------------------------------|
| POST   | /customers                                | Create a new customer profile                        |
| GET    | /customers/{customerId}                   | Retrieve customer information and verification status |
| PUT    | /customers/{customerId}                   | Update customer personal information                 |
| PUT    | /customers/{customerId}/kyc-status        | Update KYC verification status                       |
| GET    | /customers/{customerId}/compliance-status | Get current AML and compliance standing              |
| GET    | /health                                   | Health check endpoint                                |

## Event Contracts

### Produced

| Topic                    | Trigger                                                  | Key Payload Fields                                                        |
|--------------------------|----------------------------------------------------------|---------------------------------------------------------------------------|
| `customer.created`       | New customer completes initial registration (POST)       | customerId, email, firstName, lastName, onboardingStatus, createdAt       |
| `customer.kyc_completed` | Customer passes KYC verification (PUT /kyc-status → APPROVED) | customerId, kycStatus, kycCompletedAt, verificationProvider          |
| `customer.status_changed`| Compliance or account status changes                     | customerId, previousStatus, newStatus, reason, changedAt                  |

### Consumed

_(none — this service does not consume any events)_

## Dependencies

- **None** — CustomerManagement has no upstream service dependencies within the ecosystem. It is a foundational service.

## Tech Stack

- **Runtime**: Node.js >= 20
- **Framework**: Express 4.x
- **Validation**: express-validator
- **ID Generation**: uuid v4
- **Storage**: In-memory store (Map) — suitable for development; swap for a persistent DB in production
- **Logging**: morgan (combined format)
- **CORS**: cors middleware

## Environment Variables

| Variable       | Default              | Description                                      |
|----------------|----------------------|--------------------------------------------------|
| `PORT`         | `8080`               | HTTP port the service listens on                 |
| `NODE_ENV`     | `development`        | Runtime environment (development / production)   |
| `LOG_LEVEL`    | `combined`           | Morgan log format                                |
| `EVENT_BUS_URL`| _(optional)_         | URL of the event bus / message broker for publishing events |

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
