// This service contains no business logic. It translates foreign API responses to internal events only.

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const client = require('./client');
const translator = require('./translator');
const producer = require('./producer');

const app = express();

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// ---------------------------------------------------------------------------
// Health endpoint — the only HTTP route in this provider service
// ---------------------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'market-data-provider' });
});

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || '8080', 10);
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10);
const WATCHED_SYMBOLS = (process.env.WATCHED_SYMBOLS || 'AAPL,MSFT,GOOGL,AMZN,TSLA')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Track the last set of corporate-action event IDs we have already published
// so we do not re-emit stale actions on every poll cycle.
const publishedCorporateActionIds = new Set();

// ---------------------------------------------------------------------------
// Polling helpers
// ---------------------------------------------------------------------------

/**
 * Poll real-time quotes for all watched symbols and publish market.quote_updated
 * events for each one.
 */
async function pollQuotes() {
  for (const symbol of WATCHED_SYMBOLS) {
    try {
      const raw = await client.fetchQuote(symbol);
      const event = translator.translateQuote(raw);
      await producer.publish('market.quote_updated', event);
      console.log(`[poll] Published market.quote_updated for ${symbol} @ ${event.lastPrice}`);
    } catch (err) {
      console.error(`[poll] Error fetching/publishing quote for ${symbol}:`, err.message);
    }
  }
}

/**
 * Poll corporate actions for all watched symbols and publish market.corporate_action
 * events for any actions that have not been published yet.
 */
async function pollCorporateActions() {
  const today = new Date().toISOString().slice(0, 10);
  // Look back 7 days so we catch any actions that arrived while the service was down
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  for (const symbol of WATCHED_SYMBOLS) {
    try {
      const raw = await client.fetchCorporateActions(symbol, {
        from: sevenDaysAgo,
        to: today,
      });

      // MarketDataAPI returns { symbol, actions: [...] } or an array directly
      const actions = Array.isArray(raw) ? raw : raw.actions || [];

      for (const action of actions) {
        // Derive a deduplication key from symbol + type + exDate
        const dedupKey = `${action.symbol}:${action.type}:${action.exDate}`;
        if (publishedCorporateActionIds.has(dedupKey)) {
          continue;
        }

        const event = translator.translateCorporateAction(action);
        await producer.publish('market.corporate_action', event);
        publishedCorporateActionIds.add(dedupKey);
        console.log(
          `[poll] Published market.corporate_action for ${symbol} type=${action.type} exDate=${action.exDate}`
        );
      }
    } catch (err) {
      console.error(
        `[poll] Error fetching/publishing corporate actions for ${symbol}:`,
        err.message
      );
    }
  }
}

/**
 * Run one full polling cycle: quotes + corporate actions.
 * Uses a recursive setTimeout so that the next cycle does not start until the
 * current one completes, preventing overlapping executions.
 */
async function runPollingCycle() {
  await Promise.allSettled([pollQuotes(), pollCorporateActions()]);

  setTimeout(runPollingCycle, POLL_INTERVAL_MS);
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function start() {
  try {
    await producer.connect();

    app.listen(PORT, () => {
      console.log(`[server] market-data-provider listening on port ${PORT}`);
      console.log(`[server] Foreign API base URL: ${process.env.FOREIGN_API_BASE_URL || 'https://api.marketdata.com'}`);
      console.log(`[server] Watching symbols: ${WATCHED_SYMBOLS.join(', ')}`);
      console.log(`[server] Poll interval: ${POLL_INTERVAL_MS}ms`);
    });

    // Kick off the first polling cycle immediately
    runPollingCycle();
  } catch (err) {
    console.error('[server] Failed to start:', err);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
async function shutdown(signal) {
  console.log(`[server] Received ${signal}; shutting down gracefully`);
  try {
    await producer.disconnect();
  } catch (err) {
    console.error('[server] Error during shutdown:', err.message);
  }
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
