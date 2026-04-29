# MarketDataProvider — Service Specification

## Purpose

MarketDataProvider wraps the external `MarketDataAPI` to supply the Stock Trading ecosystem with real-time security quotes, historical price data, and corporate action events (dividends, splits, spin-offs). It is a **provider-archetype** service: it performs only translation from foreign API response shapes to internal event payloads, then publishes those events to Kafka. No business logic lives here.

## Tech Stack

| Concern         | Technology                    |
|-----------------|-------------------------------|
| Runtime         | Node.js >= 20                 |
| HTTP framework  | Express                       |
| Messaging       | KafkaJS (producer only)       |
| HTTP client     | node-fetch                    |
| Request logging | morgan                        |
| Identity        | uuid                          |

## Archetype

**Provider** — wraps external API; translation only; no business logic; no domain persistence.

---

## API Endpoints

This service exposes **no domain HTTP routes**. Data flows outward through Kafka only.

| Method | Path      | Description                              | Request Body | Response Shape                              |
|--------|-----------|------------------------------------------|--------------|----------------------------------------------|
| GET    | /health   | Liveness probe for orchestration systems | _(none)_     | `{ "ok": true, "service": "market-data-provider" }` |

---

## Events Produced

| Topic                     | Trigger                                                                 | Payload Shape                                                                                                                                                                                    |
|---------------------------|-------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `market.quote_updated`    | Polling loop fetches a real-time quote from MarketDataAPI               | `{ eventId, eventType, occurredAt, symbol, exchange, bidPrice, askPrice, lastPrice, lastSize, volume, openPrice, highPrice, lowPrice, closePrice, changeAmount, changePercent, marketSession, quoteTimestamp }` |
| `market.corporate_action` | Polling loop detects a new corporate action from MarketDataAPI          | `{ eventId, eventType, occurredAt, symbol, actionType, exDate, recordDate, payDate, amount, ratio, currency, description }`                                                                       |

### Payload Field Glossary

**`market.quote_updated`**

| Field            | Type     | Description                                         |
|------------------|----------|-----------------------------------------------------|
| `eventId`        | string   | UUID v4 uniquely identifying this event             |
| `eventType`      | string   | Always `"market.quote_updated"`                     |
| `occurredAt`     | string   | ISO-8601 timestamp when event was created           |
| `symbol`         | string   | Ticker symbol, e.g. `"AAPL"`                        |
| `exchange`       | string   | Exchange code, e.g. `"NASDAQ"`                      |
| `bidPrice`       | number   | Current best bid price                              |
| `askPrice`       | number   | Current best ask price                              |
| `lastPrice`      | number   | Price of the last executed trade                    |
| `lastSize`       | number   | Size (shares) of the last executed trade            |
| `volume`         | number   | Total shares traded today                           |
| `openPrice`      | number   | Opening price for the current session               |
| `highPrice`      | number   | Session high price                                  |
| `lowPrice`       | number   | Session low price                                   |
| `closePrice`     | number   | Previous session closing price                      |
| `changeAmount`   | number   | Price change vs. prior close                        |
| `changePercent`  | number   | Percentage change vs. prior close                   |
| `marketSession`  | string   | `"pre"`, `"regular"`, or `"post"`                   |
| `quoteTimestamp` | string   | ISO-8601 timestamp from the foreign API             |

**`market.corporate_action`**

| Field         | Type     | Description                                                        |
|---------------|----------|--------------------------------------------------------------------|
| `eventId`     | string   | UUID v4 uniquely identifying this event                            |
| `eventType`   | string   | Always `"market.corporate_action"`                                 |
| `occurredAt`  | string   | ISO-8601 timestamp when event was created                          |
| `symbol`      | string   | Ticker symbol affected by the corporate action                     |
| `actionType`  | string   | `"dividend"`, `"split"`, `"spinoff"`, `"merger"`, or `"special"`  |
| `exDate`      | string   | Ex-dividend / ex-distribution date (ISO-8601 date)                 |
| `recordDate`  | string   | Record date for eligibility (ISO-8601 date)                        |
| `payDate`     | string   | Payment or effective date (ISO-8601 date)                          |
| `amount`      | number   | Cash dividend amount per share, or split ratio numerator           |
| `ratio`       | number   | Split ratio denominator (null for dividend actions)                |
| `currency`    | string   | ISO-4217 currency code, e.g. `"USD"`                               |
| `description` | string   | Human-readable description of the corporate action                 |

---

## Events Consumed

_(none)_ — This service does not subscribe to any Kafka topics.

---

## Dependencies

| Dependency       | Rationale                                                          |
|------------------|--------------------------------------------------------------------|
| _(none internal)_ | MarketDataProvider has no upstream service dependencies. It only calls the external MarketDataAPI and publishes to Kafka. |

---

## Environment Variables

| Variable               | Default                          | Required | Description                                                                        |
|------------------------|----------------------------------|----------|------------------------------------------------------------------------------------|
| `PORT`                 | `8080`                           | No       | TCP port for the Express server                                                    |
| `FOREIGN_API_BASE_URL` | `https://api.marketdata.com`     | No       | Base URL of the MarketDataAPI; override to mock URL in dev/stage                   |
| `FOREIGN_API_KEY`      | _(none)_                         | **Yes**  | API key sent as `x-api-key` header on all requests to MarketDataAPI                |
| `KAFKA_BROKERS`        | `localhost:9092`                 | No       | Comma-separated list of Kafka broker host:port pairs                               |
| `POLL_INTERVAL_MS`     | `5000`                           | No       | Milliseconds between each polling iteration                                        |
| `WATCHED_SYMBOLS`      | `AAPL,MSFT,GOOGL,AMZN,TSLA`     | No       | Comma-separated ticker symbols to poll for quotes and corporate actions            |
