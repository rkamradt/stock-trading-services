# SettlementProvider — Service Specification

## Purpose

SettlementProvider wraps the external **DTCC Settlement Network** (`https://api.dtcc.com`) to process trade settlement instructions and query settlement status on behalf of the Stock Trading ecosystem. It is a pure provider/adapter: it calls the foreign API, translates responses to internal event shapes, and publishes those events to Kafka. It contains no business logic.

## Tech Stack

| Concern         | Technology                      |
|-----------------|---------------------------------|
| Runtime         | Node.js >= 20                   |
| HTTP Framework  | Express 4                       |
| Messaging       | KafkaJS                         |
| HTTP Client     | node-fetch 2                    |
| Auth (foreign)  | OAuth2 (client credentials)     |
| ID generation   | uuid v4                         |
| Logging         | morgan (combined)               |
| CORS            | cors                            |

## Archetype

**Provider** — wraps a foreign API. No domain HTTP routes. No business logic. No persistence. Translation only.

---

## API Endpoints

This service exposes **no domain HTTP routes**.

| Method | Path      | Description                         | Request Body | Response Shape               |
|--------|-----------|-------------------------------------|--------------|------------------------------|
| GET    | /health   | Liveness/readiness probe            | none         | `{ ok: true, service: "settlement-provider" }` |

---

## Events Produced

| Topic                  | Trigger                                                            | Payload Shape |
|------------------------|--------------------------------------------------------------------|---------------|
| `settlement.submitted` | Emitted when settlement instructions are sent to external network  | `{ eventId, topic, occurredAt, tradeId, settlementId, accountId, symbol, quantity, netAmount, currency, settlementDate, counterpartyId, instructionType, status }` |
| `settlement.confirmed` | Emitted when external system confirms successful settlement         | `{ eventId, topic, occurredAt, tradeId, settlementId, accountId, symbol, quantity, settledAmount, currency, settledAt, counterpartyId, confirmationReference }` |
| `settlement.failed`    | Emitted when settlement fails in external system                   | `{ eventId, topic, occurredAt, tradeId, settlementId, accountId, symbol, quantity, failureReason, failureCode, failedAt, counterpartyId, retryEligible }` |
| `settlement.exception` | Emitted when manual intervention is required for settlement        | `{ eventId, topic, occurredAt, tradeId, settlementId, accountId, symbol, exceptionType, exceptionDescription, raisedAt, priority, assignedTo }` |

---

## Events Consumed

_(none — this service does not consume any Kafka topics)_

---

## Dependencies and Rationale

| Dependency       | Rationale                                                                                          |
|------------------|----------------------------------------------------------------------------------------------------|
| trading-service  | Source of trade execution records requiring settlement instructions to be submitted to DTCC/NSCC   |

### Foreign API

| Property     | Value                                              |
|--------------|----------------------------------------------------|
| Name         | DTCC Settlement Network                            |
| Base URL     | `https://api.dtcc.com`                             |
| Auth Method  | OAuth2 (client credentials grant)                  |
| Mock         | `http://settlement-provider-mock:3000`             |

---

## Environment Variables

| Variable               | Default                               | Required | Description                                               |
|------------------------|---------------------------------------|----------|-----------------------------------------------------------|
| `PORT`                 | `8080`                                | No       | HTTP port for the Express health endpoint                 |
| `FOREIGN_API_BASE_URL` | `https://api.dtcc.com`                | No       | Base URL for the DTCC Settlement Network foreign API      |
| `DTCC_TOKEN_URL`       | `https://api.dtcc.com/oauth2/token`   | No       | OAuth2 token endpoint URL                                 |
| `DTCC_CLIENT_ID`       | _(none)_                              | Yes      | OAuth2 client ID for DTCC API                             |
| `DTCC_CLIENT_SECRET`   | _(none)_                              | Yes      | OAuth2 client secret for DTCC API                         |
| `KAFKA_BROKERS`        | `localhost:9092`                      | No       | Comma-separated Kafka broker list                         |
| `POLL_INTERVAL_MS`     | `15000`                               | No       | How often (ms) to poll DTCC for settlement status updates |

---

## Polling Loop Behaviour

On startup the service:
1. Connects the Kafka producer.
2. Enters a polling loop (`setInterval` at `POLL_INTERVAL_MS`).
3. Each iteration fetches the settlement reports endpoint from DTCC, classifies each record by status, translates to the appropriate internal event shape, and publishes to the matching Kafka topic.
4. The `/health` endpoint remains available throughout.
