# MarketDataProvider — Claude Code Context

## Role in the Stock Trading Ecosystem

MarketDataProvider is a **provider-archetype** service in the Stock Trading platform. Its sole purpose is to wrap the external `MarketDataAPI` (https://api.marketdata.com) and translate its responses into internal ecosystem events published over Kafka. It acts as the authoritative source of market data for all downstream services that need real-time quotes, historical prices, and corporate action data.

Downstream consumers include:
- **PortfolioService** — uses market data for P&L calculations
- **MarginService** — uses quotes for collateral and buying power calculations
- **DerivativesTradingService** — uses quotes and corporate actions for Greeks and pricing
- **RiskManagementService** — uses quotes for VaR and real-time risk metrics

## API Surface

This service exposes **no domain HTTP routes**. The only HTTP endpoint is:

| Method | Path      | Description                    |
|--------|-----------|--------------------------------|
| GET    | /health   | Liveness check for the service |

All data flows outward via Kafka events — not HTTP responses.

## Event Contracts

### Produces

| Topic                      | Trigger                                              | Description                                              |
|----------------------------|------------------------------------------------------|----------------------------------------------------------|
| `market.quote_updated`     | Polling loop detects a real-time price change        | Emitted when real-time price data changes for a security |
| `market.corporate_action`  | Polling loop detects a new corporate action event    | Emitted for dividends, splits, and other corporate events |

### Consumes

_(none)_ — This service does not consume any Kafka topics.

## Dependencies

- **None** — MarketDataProvider has no upstream service dependencies within the ecosystem. It only calls the external `MarketDataAPI`.

## Tech Stack

- **Runtime:** Node.js >= 20
- **Framework:** Express (health endpoint only)
- **Messaging:** KafkaJS (producer only)
- **HTTP Client:** node-fetch (calls external MarketDataAPI)
- **Logging:** morgan (HTTP request logging)

## Environment Variables

| Variable                | Default                          | Description                                                                       |
|-------------------------|----------------------------------|-----------------------------------------------------------------------------------|
| `PORT`                  | `8080`                           | Port the Express server listens on                                                |
| `FOREIGN_API_BASE_URL`  | `https://api.marketdata.com`     | Base URL for the MarketDataAPI; set to mock URL in dev/stage                      |
| `FOREIGN_API_KEY`       | _(required)_                     | API key for authenticating with MarketDataAPI                                     |
| `KAFKA_BROKERS`         | `localhost:9092`                 | Comma-separated list of Kafka broker addresses                                    |
| `POLL_INTERVAL_MS`      | `5000`                           | Milliseconds between polling cycles for quote updates                             |
| `WATCHED_SYMBOLS`       | `AAPL,MSFT,GOOGL,AMZN,TSLA`     | Comma-separated list of symbols to poll for quotes and corporate actions          |

In **dev/stage**, set:
```
FOREIGN_API_BASE_URL=http://market-data-provider-mock:3000
```
to route all external API calls to the companion mock service.

---

## Archetype Constraints — Provider service

This service IS responsible for:
- Calling the MarketDataAPI API via src/client.js
- Translating foreign API responses to internal event format via src/translator.js
- Publishing translated events to the ecosystem via Kafka (src/producer.js)

This service is NOT responsible for:
- ANY business logic — translation only, no domain decisions
- Persisting data
- Exposing domain HTTP routes — /health is the only HTTP endpoint

IMPORTANT: This service contains no business logic.
It translates foreign API responses to internal events only.
If you find yourself adding conditional logic beyond field mapping, stop — that logic belongs in a domain service.
