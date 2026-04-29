# CustomerManagement — Service Specification

## Overview

| Field      | Value                                                                                              |
|------------|----------------------------------------------------------------------------------------------------|
| Service ID | `customer-management`                                                                              |
| Archetype  | HTTP — standard REST service with domain routes and business logic                                 |
| Tech Stack | Node.js >= 20, Express 4.x, express-validator, uuid, cors, morgan                                 |
| Purpose    | Owns customer identity, personal information, KYC/AML compliance status, and onboarding workflow   |

---

## API Endpoints

| Method | Path                                          | Description                                            | Request Body                                                                                                                                                                  | Response Shape                                                                                                                                                                                                   |
|--------|-----------------------------------------------|--------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| POST   | `/customers`                                  | Create a new customer profile                          | `{ firstName, lastName, email, phoneNumber, dateOfBirth, ssn, address: { street, city, state, postalCode, country }, nationality, employmentStatus, annualIncome }` | `201` `{ customerId, firstName, lastName, email, phoneNumber, dateOfBirth, address, nationality, employmentStatus, annualIncome, kycStatus, complianceStatus, onboardingStatus, createdAt, updatedAt }` |
| GET    | `/customers/{customerId}`                     | Retrieve customer information and verification status  | —                                                                                                                                                                             | `200` full customer object (same shape as POST response)                                                                                                                                                         |
| PUT    | `/customers/{customerId}`                     | Update customer personal information                   | Any subset of `{ firstName, lastName, phoneNumber, address, employmentStatus, annualIncome }`                                                                                | `200` updated customer object                                                                                                                                                                                    |
| PUT    | `/customers/{customerId}/kyc-status`          | Update KYC verification status                         | `{ kycStatus, verificationProvider?, verificationReference?, notes? }` — `kycStatus` ∈ `PENDING`, `IN_REVIEW`, `APPROVED`, `REJECTED`, `EXPIRED`                           | `200` `{ customerId, kycStatus, kycCompletedAt, verificationProvider, verificationReference, notes, updatedAt }`                                                                                                 |
| GET    | `/customers/{customerId}/compliance-status`   | Get current AML and compliance standing                | —                                                                                                                                                                             | `200` `{ customerId, complianceStatus, amlStatus, sanctionsScreeningStatus, lastReviewedAt, riskRating, flags }`                                                                                                 |
| GET    | `/health`                                     | Health check                                           | —                                                                                                                                                                             | `200` `{ ok: true, service: "customer-management" }`                                                                                                                                                             |

### Field Enumerations

- **kycStatus**: `PENDING` | `IN_REVIEW` | `APPROVED` | `REJECTED` | `EXPIRED`
- **complianceStatus**: `CLEAR` | `UNDER_REVIEW` | `RESTRICTED` | `BLOCKED`
- **amlStatus**: `CLEAR` | `FLAGGED` | `UNDER_INVESTIGATION`
- **sanctionsScreeningStatus**: `CLEAR` | `POTENTIAL_MATCH` | `CONFIRMED_MATCH`
- **onboardingStatus**: `INITIATED` | `KYC_PENDING` | `KYC_IN_REVIEW` | `ACTIVE` | `REJECTED` | `SUSPENDED`
- **riskRating**: `LOW` | `MEDIUM` | `HIGH`
- **employmentStatus**: `EMPLOYED` | `SELF_EMPLOYED` | `UNEMPLOYED` | `RETIRED` | `STUDENT` | `OTHER`

---

## Events Produced

| Topic                    | Trigger                                                              | Payload Shape                                                                                                                                  |
|--------------------------|----------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|
| `customer.created`       | New customer completes initial registration via `POST /customers`    | `{ eventType, customerId, email, firstName, lastName, onboardingStatus, kycStatus, createdAt, timestamp }`                                     |
| `customer.kyc_completed` | KYC status transitions to `APPROVED` via `PUT /kyc-status`          | `{ eventType, customerId, kycStatus, kycCompletedAt, verificationProvider, verificationReference, timestamp }`                                 |
| `customer.status_changed`| `complianceStatus`, `onboardingStatus`, or `kycStatus` changes      | `{ eventType, customerId, field, previousValue, newValue, reason, changedAt, timestamp }`                                                      |

---

## Events Consumed

| Topic | Handler | What It Does |
|-------|---------|--------------|
| _(none)_ | — | This service does not subscribe to any external events |

---

## Dependencies and Rationale

| Service | Rationale |
|---------|-----------|
| _(none)_ | CustomerManagement is a foundational root service. No upstream dependencies within the ecosystem. |

---

## Environment Variables

| Variable           | Required | Default       | Description                                                        |
|--------------------|----------|---------------|--------------------------------------------------------------------|
| `PORT`             | No       | `8080`        | TCP port the HTTP server listens on                                |
| `NODE_ENV`         | No       | `development` | Runtime environment — affects logging verbosity and error details  |
| `EVENT_BUS_URL`    | No       | _(none)_      | URL of the event bus broker for publishing domain events           |
| `LOG_FORMAT`       | No       | `combined`    | Morgan log format (`combined`, `dev`, `tiny`)                      |
