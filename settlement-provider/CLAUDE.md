# SettlementProvider — Claude Code Context

## Role in the Stock Trading Ecosystem

SettlementProvider is a **provider-archetype** service in the Stock Trading ecosystem. Its sole responsibility is to wrap the external **DTCC Settlement Network** API (`https://api.dtcc.com`) and translate its responses into internal ecosystem events published to Kafka. It acts as an anti-corruption layer between the external clearing/settlement world and the rest of the platform.

It is depended upon by `trading-service`, which submits settlement instructions after trade execution and queries settlement status.

## API Surface

This service exposes **no domain HTTP routes**. The only HTTP endpoint is:

| Method | Path      | Description               |
|--------|-----------|---------------------------|
| GET    | /health   | Liveness check            |

All domain interactions are driven by the internal polling loop that calls the DTCC Settlement Network and publishes events to Kafka.

## Event Contracts

### Produces

| Topic                    | Trigger                                                          |
|--------------------------|------------------------------------------------------------------|
| `settlement.submitted`   | Emitted when settlement instructions are sent to external network |
| `settlement.confirmed`   | Emitted when external system confirms successful settlement       |
| `settlement.failed`      | Emitted when settlement fails in external system                  |
| `settlement.exception`   | Emitted when manual intervention is required for settlement       |

### Consumes

_(none)_

## Dependencies

| Service          | Reason                                                               |
|------------------|----------------------------------------------------------------------|
| trading-service  | Source of trade executions that require settlement instructions       |

## Tech Stack

- **Runtime**: Node.js >= 20
- **Framework**: Express (health endpoint only)
- **Messaging**: KafkaJS
- **HTTP Client**: node-fetch (OAuth2 token management for DTCC API)
- **Utilities**: uuid, morgan, cors

## Environment Variables

| Variable               | Default                    | Description                                              |
|------------------------|----------------------------|----------------------------------------------------------|
| `PORT`                 | `8080`                     | HTTP port for the Express server                         |
| `FOREIGN_API_BASE_URL` | `https://api.dtcc.com`     | Base URL for DTCC Settlement Network API                 |
| `DTCC_TOKEN_URL`       | `https://api.dtcc.com/oauth2/token` | OAuth2 token endpoint for DTCC API             |
| `DTCC_CLIENT_ID`       | _(required)_               | OAuth2 client ID for DTCC API authentication             |
| `DTCC_CLIENT_SECRET`   | _(required)_               | OAuth2 client secret for DTCC API authentication         |
| `KAFKA_BROKERS`        | `localhost:9092`           | Comma-separated list of Kafka broker addresses           |
| `POLL_INTERVAL_MS`     | `15000`                    | Polling interval in milliseconds for settlement updates  |

> In dev/stage: set `FOREIGN_API_BASE_URL=http://settlement-provider-mock:3000` to use the companion mock service.

## Archetype Constraints — Provider service

This service IS responsible for:
- Calling the DTCC Settlement Network API via src/client.js
- Translating foreign API responses to internal event format via src/translator.js
- Publishing translated events to the ecosystem via Kafka (src/producer.js)

This service is NOT responsible for:
- ANY business logic — translation only, no domain decisions
- Persisting data
- Exposing domain HTTP routes — /health is the only HTTP endpoint

IMPORTANT: This service contains no business logic.
It translates foreign API responses to internal events only.
If you find yourself adding conditional logic beyond field mapping, stop — that logic belongs in a domain service.
