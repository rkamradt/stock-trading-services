# settlement-provider-mock — Test Mock

> ⚠️ This service exists ONLY for testing in dev and stage environments.
> It MUST NOT be deployed to production under any circumstances.

## Purpose

`settlement-provider-mock` is the companion mock service for `settlement-provider`. It simulates
the DTCC Settlement Network API (`https://api.dtcc.com`) locally, allowing the provider service
to run end-to-end in dev and stage environments without reaching the real external network.

All foreign API endpoints called by `settlement-provider/src/client.js` are replicated here with
realistic canned responses. The mock also exposes control endpoints for inspecting recorded calls
and injecting failures — enabling deterministic, repeatable contract and integration tests.

## Usage

Set the following environment variable in the `settlement-provider` service configuration for dev
and stage environments:

```
FOREIGN_API_BASE_URL=http://settlement-provider-mock:3000
```

Start the mock:

```bash
# Production-style start
npm start
# or
node index.js

# Development (auto-reload on changes)
npm run dev
```

Default port: **3000** — override with the `PORT` environment variable:

```bash
PORT=4000 node index.js
```

When running in Docker Compose, the service is reachable at `http://settlement-provider-mock:3000`
from sibling containers (assuming the service is named `settlement-provider-mock` in the Compose
file).

## Endpoints

### Utility / control

| Method   | Path            | Description                                                                 |
|----------|-----------------|-----------------------------------------------------------------------------|
| `GET`    | `/health`       | Liveness check — returns `{ ok: true, service: "settlement-provider-mock" }` |
| `GET`    | `/mock/calls`   | Returns array of all recorded inbound calls (use in test assertions)        |
| `POST`   | `/mock/config`  | Configure failure simulation — body: `{ "failNext": true, "statusCode": 503 }` |
| `DELETE` | `/mock/calls`   | Clear the call log between tests                                             |

### Simulated DTCC Settlement Network API endpoints

| Method   | Path                                              | Produces event              |
|----------|---------------------------------------------------|-----------------------------|
| `POST`   | `/v1/oauth/token`                                 | — (OAuth2 token exchange)   |
| `POST`   | `/v1/settlement/instructions`                     | `settlement.submitted`      |
| `GET`    | `/v1/settlement/instructions`                     | —                           |
| `GET`    | `/v1/settlement/instructions/:instructionId`      | `settlement.confirmed`      |
| `PUT`    | `/v1/settlement/instructions/:instructionId`      | —                           |
| `DELETE` | `/v1/settlement/instructions/:instructionId`      | —                           |
| `POST`   | `/v1/settlement/instructions/:instructionId/affirm`  | —                        |
| `POST`   | `/v1/settlement/instructions/:instructionId/cancel`  | `settlement.failed`      |
| `GET`    | `/v1/settlement/exceptions`                       | `settlement.exception`      |
| `GET`    | `/v1/settlement/exceptions/:exceptionId`          | `settlement.exception`      |
| `POST`   | `/v1/settlement/exceptions/:exceptionId/resolve`  | —                           |
| `GET`    | `/v1/settlement/status`                           | —                           |
| `GET`    | `/v1/participants`                                | —                           |
| `GET`    | `/v1/participants/:participantId`                 | —                           |
| `GET`    | `/v1/securities/:cusip`                           | —                           |

All canned responses are defined in `responses.json` and loaded at startup.

## Simulating failures

Send a `POST /mock/config` request before the call you want to fail:

```bash
curl -X POST http://localhost:3000/mock/config \
  -H "Content-Type: application/json" \
  -d '{ "failNext": true, "statusCode": 500 }'
```

The **next** request to any foreign API endpoint will return the configured status code and the
body `{ "error": "simulated failure" }`. After that one failure, `failNext` automatically resets
to `false` and subsequent requests return normal canned responses again.

You can also override just the status code without triggering a failure:

```bash
# Pre-arm a 503 failure
curl -X POST http://localhost:3000/mock/config \
  -d '{ "failNext": true, "statusCode": 503 }' \
  -H "Content-Type: application/json"
```

## Customising responses

**Static edits** — modify `responses.json` and restart the mock. Every key follows the format
`"METHOD /v1/path/{paramName}"`, for example:

```json
{
  "POST /v1/settlement/instructions": {
    "status": 202,
    "body": { "instructionId": "INSTR-TEST-001", "status": "SUBMITTED" }
  }
}
```

**Dynamic overrides** — extend `index.js` to accept a `POST /mock/responses` endpoint that writes
into an in-memory override map checked before the static `responses.json` data. This is not
implemented by default but is a straightforward addition for teams needing per-test response
customisation without restarting the server.
