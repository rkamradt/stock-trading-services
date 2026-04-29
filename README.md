# Stock Trading

The Stock Trading platform is a full-featured brokerage ecosystem composed of twelve microservices covering the complete lifecycle of securities trading: customer onboarding and KYC/AML compliance, real-time market data ingestion, brokerage account management, equity and derivative position tracking, margin lending, trade order execution and settlement via DTCC/NSCC integration, portfolio risk monitoring and pre-trade risk checks, regulatory compliance surveillance, automated reporting, and multi-channel customer notifications — all wired together through Kafka for cross-domain events and direct REST calls for same-domain interactions.

---

## Services

| Service | Archetype | Port | Health Endpoint | Description |
|---------|-----------|------|-----------------|-------------|
| `customer-management` | http | 8001 | `GET /actuator/health` | Owns customer identity, personal information, KYC/AML compliance status, and onboarding workflow |
| `market-data-provider` | provider | 8002 | `GET /health` | Wraps external market data APIs to provide real-time quotes, historical prices, and corporate actions to the ecosystem |
| `account-service` | http | 8003 | `GET /actuator/health` | Owns customer brokerage accounts, balances, trading permissions, and account-level settings |
| `portfolio-service` | http | 8004 | `GET /actuator/health` | Owns physical stock positions per account, cost basis tracking, and realized/unrealized P&L calculations |
| `trading-service` | http | 8005 | `GET /actuator/health` | Owns trade order lifecycle, execution, and settlement including order types, fills, and integration with execution venues |
| `margin-service` | http | 8006 | `GET /actuator/health` | Owns margin account calculations, buying power, margin calls, interest on borrowed funds, and liquidation triggers |
| `derivatives-trading-service` | http | 8007 | `GET /actuator/health` | Owns derivative instrument definitions, options chains, derivative position tracking, Greeks calculations, and exercise/assignment processing |
| `risk-management-service` | http | 8008 | `GET /actuator/health` | Owns real-time portfolio risk monitoring, pre-trade risk checks, position limits, and regulatory compliance oversight |
| `settlement-provider` | provider | 8009 | `GET /actuator/health` | Wraps external clearing and settlement networks (DTCC, NSCC) to process trade settlement instructions and status |
| `reporting-service` | http | 8010 | `GET /actuator/health` | Owns account statements, trade confirmations, portfolio analytics, and regulatory compliance reporting |
| `notification-service` | messaging | 8011 | `GET /actuator/health` | Owns real-time customer notifications, alert management, delivery preferences, and multi-channel communication |
| `compliance-service` | http | 8012 | `GET /actuator/health` | Owns audit trails, regulatory reporting, trade surveillance, and compliance monitoring across all brokerage activities |

---

## Quick Start

### Prerequisites

- Java 17+ (Spring Boot services)
- Node.js 18+ (`market-data-provider`)
- Kafka running locally or via Docker (`KAFKA_BROKERS` env var required for messaging/provider/adaptor services)

### Running each service locally

#### `customer-management` (http · port 8001)
```bash
cd customer-management
./mvnw spring-boot:run
# Health: http://localhost:8001/actuator/health
```

#### `market-data-provider` (provider · port 8002)
```bash
cd market-data-provider
npm install
PORT=8002 \
KAFKA_BROKERS=localhost:9092 \
FOREIGN_API_BASE_URL=https://api.marketdata.com \
MARKET_DATA_API_KEY=<your-api-key> \
node src/index.js
# Health: http://localhost:8002/health
# Note: set FOREIGN_API_BASE_URL=http://localhost:9002 to use the market-data-provider-mock companion instead
```

#### `account-service` (http · port 8003)
```bash
cd account-service
./mvnw spring-boot:run
# Health: http://localhost:8003/actuator/health
```

#### `portfolio-service` (http · port 8004)
```bash
cd portfolio-service
./mvnw spring-boot:run
# Health: http://localhost:8004/actuator/health
```

#### `trading-service` (http · port 8005)
```bash
cd trading-service
./mvnw spring-boot:run
# Health: http://localhost:8005/actuator/health
```

#### `margin-service` (http · port 8006)
```bash
cd margin-service
./mvnw spring-boot:run
# Health: http://localhost:8006/actuator/health
```

#### `derivatives-trading-service` (http · port 8007)
```bash
cd derivatives-trading-service
./mvnw spring-boot:run
# Health: http://localhost:8007/actuator/health
```

#### `risk-management-service` (http · port 8008)
```bash
cd risk-management-service
KAFKA_BROKERS=localhost:9092 \
./mvnw spring-boot:run
# Health: http://localhost:8008/actuator/health
```

#### `settlement-provider` (provider · port 8009)
```bash
cd settlement-provider
KAFKA_BROKERS=localhost:9092 \
FOREIGN_API_BASE_URL=https://api.dtcc.com \
DTCC_CLIENT_ID=<your-client-id> \
DTCC_CLIENT_SECRET=<your-client-secret> \
./mvnw spring-boot:run
# Health: http://localhost:8009/actuator/health
# Note: set FOREIGN_API_BASE_URL=http://localhost:9009 to use the settlement-provider-mock companion instead
```

#### `reporting-service` (http · port 8010)
```bash
cd reporting-service
./mvnw spring-boot:run
# Health: http://localhost:8010/actuator/health
```

#### `notification-service` (messaging · port 8011)
```bash
cd notification-service
KAFKA_BROKERS=localhost:9092 \
./mvnw spring-boot:run
# Health: http://localhost:8011/actuator/health
# Consumes Kafka topics: order.filled, margin.call_triggered, risk.limit_breached
```

#### `compliance-service` (http · port 8012)
```bash
cd compliance-service
./mvnw spring-boot:run
# Health: http://localhost:8012/actuator/health
```

---

## Mock services (dev/stage only)

The following mock services are provided for local development and staging environments to simulate third-party external APIs without incurring costs or requiring credentials.

### `market-data-provider-mock`

Simulates the external **MarketDataAPI** (`https://api.marketdata.com`). Returns deterministic or randomised quote, historical price, and corporate action data so that `market-data-provider` and any downstream service can run fully offline.

```bash
cd market-data-provider-mock
npm install
PORT=9002 node src/index.js
```

Point `market-data-provider` at the mock by setting:
```bash
FOREIGN_API_BASE_URL=http://localhost:9002
```

### `settlement-provider-mock`

Simulates the external **DTCC Settlement Network** (`https://api.dtcc.com`). Returns canned settlement confirmations, status responses, and exception scenarios so that `settlement-provider` can be exercised end-to-end without a live DTCC connection.

```bash
cd settlement-provider-mock
./mvnw spring-boot:run -Dspring-boot.run.arguments="--server.port=9009"
```

Point `settlement-provider` at the mock by setting:
```bash
FOREIGN_API_BASE_URL=http://localhost:9009
```

---

## ⚠️ Production deployment

**Mock directories (`market-data-provider-mock/`, `settlement-provider-mock/`) must never be deployed to production.** They contain no authentication, no data integrity guarantees, and exist solely as development and testing scaffolding. Ensure your production CI/CD pipeline and infrastructure-as-code explicitly excludes any directory ending in `-mock`.
