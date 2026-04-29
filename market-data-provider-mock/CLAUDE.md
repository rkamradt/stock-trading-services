# market-data-provider-mock — Test Mock

> ⚠️ This service exists ONLY for testing in dev and stage environments.
> It MUST NOT be deployed to production under any circumstances.

## Purpose

Companion mock for the **market-data-provider** provider service. It simulates the upstream **MarketDataAPI** (`https://api.marketdata.com`) locally, returning canned responses defined in `responses.json`. This allows the provider — and any consumer services — to be exercised end-to-end without making real network calls or consuming paid API quota.

The mock supports:
- Realistic canned responses for every MarketDataAPI endpoint consumed by the provider (including endpoints that produce `market.quote_updated` and `market.corporate_action` events).
- Request recording so tests can assert that the provider called the correct endpoints with the correct parameters.
- One-shot failure simulation to exercise error-handling and retry logic.

## Usage

Set the following environment variable on the **market-data-provider** service so it points at this mock instead of the real API:

```
FOREIGN_API_BASE_URL=http://market-data-provider-mock:3000
```

Start the mock:

```bash
# production-style start
npm start
# or directly
node index.js

# development (auto-restart on file changes — requires nodemon)
npm run dev
```

**Default port:** `3000`
Override with the `PORT` environment variable:

```bash
PORT=4000 node index.js
```

When running in Docker Compose the service name `market-data-provider-mock` resolves automatically, so the URL above works without changes.

## Endpoints

### Mock-control endpoints

| Method   | Path           | Description                                                        |
|----------|----------------|--------------------------------------------------------------------|
| `GET`    | `/health`      | Liveness check — returns `{ ok: true, service: "market-data-provider-mock" }` |
| `GET`    | `/mock/calls`  | Returns an array of all recorded inbound calls (for test assertions) |
| `POST`   | `/mock/config` | Configure failure simulation: `{ "failNext": true, "statusCode": 503 }` |
| `DELETE` | `/mock/calls`  | Clear the call log between tests                                   |

### Foreign API endpoints served

These mirror the MarketDataAPI routes consumed by market-data-provider:

| Method  | Path                              | Produces event                |
|---------|-----------------------------------|-------------------------------|
| `GET`   | `/v1/quotes/{symbol}`             | `market.quote_updated`        |
| `GET`   | `/v1/quotes`                      | `market.quote_updated`        |
| `GET`   | `/v1/markets/realtime`            | `market.quote_updated`        |
| `GET`   | `/v1/corporate-actions`           | `market.corporate_action`     |
| `GET`   | `/v1/corporate-actions/{symbol}`  | `market.corporate_action`     |
| `GET`   | `/v1/markets/status`              | —                             |
| `GET`   | `/v1/instruments/search`          | —                             |
| `GET`   | `/v1/instruments/{symbol}`        | —                             |
| `GET`   | `/v1/history/{symbol}`            | —                             |
| `POST`  | `/v1/quotes/batch`                | `market.quote_updated`        |

All responses are defined in `responses.json` and served with the `status` and `body` specified there.

## Simulating failures

Send a `POST /mock/config` request before the call you want to fail:

```bash
curl -s -X POST http://localhost:3000/mock/config \
  -H 'Content-Type: application/json' \
  -d '{ "failNext": true, "statusCode": 500 }'
```

The **next** request to any foreign API endpoint will return the configured status code and `{ "error": "simulated failure" }`.

`failNext` resets to `false` automatically after one failure fires, so subsequent requests resume serving normal canned responses. You can change `statusCode` independently at any time.

Useful status codes to test:
- `500` — Internal Server Error (default)
- `502` — Bad Gateway
- `503` — Service Unavailable (ideal for retry / circuit-breaker tests)
- `429` — Too Many Requests (rate-limit simulation)
- `401` — Unauthorized (invalid API key simulation)

## Customising responses

**Static edits:** Open `responses.json`, change the `status` or `body` for any endpoint, and restart the mock (`npm start`).

**Runtime overrides:** Extend `index.js` to accept a `POST /mock/responses` control endpoint that merges into the in-memory `responses` object — no restart required. This is left as an extension point to keep the default implementation minimal.
