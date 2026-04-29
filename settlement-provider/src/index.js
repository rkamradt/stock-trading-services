// This service contains no business logic. It translates foreign API responses to internal events only.

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const client = require('./client');
const translator = require('./translator');
const producer = require('./producer');

const PORT = process.env.PORT || 8080;
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '15000', 10);

// FOREIGN_API_BASE_URL is consumed by client.js.
// In dev/stage: set FOREIGN_API_BASE_URL=http://settlement-provider-mock:3000

const app = express();
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// ---------------------------------------------------------------------------
// Health endpoint — the only HTTP route exposed by this service
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'settlement-provider' });
});

// ---------------------------------------------------------------------------
// Polling loop — fetches settlement reports, translates, and publishes events
// ---------------------------------------------------------------------------

/**
 * Determine the appropriate translator function and topic for a settlement
 * report record based on its status field returned by DTCC.
 *
 * @param {object} record - A single settlement record from the DTCC reports response
 * @returns {{ topic: string, event: object } | null}
 */
function classifyAndTranslate(record) {
  const status = (record.status || '').toUpperCase();

  if (status === 'SUBMITTED' || status === 'PENDING' || status === 'INSTRUCTED') {
    return {
      topic: 'settlement.submitted',
      event: translator.toSettlementSubmitted(record),
    };
  }

  if (status === 'CONFIRMED' || status === 'SETTLED' || status === 'COMPLETED') {
    return {
      topic: 'settlement.confirmed',
      event: translator.toSettlementConfirmed(record),
    };
  }

  if (status === 'FAILED' || status === 'REJECTED') {
    return {
      topic: 'settlement.failed',
      event: translator.toSettlementFailed(record),
    };
  }

  if (status === 'EXCEPTION' || status === 'MANUAL_REVIEW' || status === 'HOLD') {
    return {
      topic: 'settlement.exception',
      event: translator.toSettlementException(record),
    };
  }

  // Unknown / intermediate statuses — skip publishing
  return null;
}

/**
 * Single polling iteration: fetches the settlement reports endpoint and
 * publishes translated events for each record.
 */
async function pollSettlementReports() {
  let reportsResponse;
  try {
    reportsResponse = await client.getSettlementReports();
  } catch (err) {
    console.error('[poll] Failed to fetch settlement reports from DTCC:', err.message);
    return;
  }

  // DTCC may return { records: [...] } or a top-level array
  const records = Array.isArray(reportsResponse)
    ? reportsResponse
    : Array.isArray(reportsResponse.records)
      ? reportsResponse.records
      : Array.isArray(reportsResponse.settlements)
        ? reportsResponse.settlements
        : [];

  if (records.length === 0) {
    console.log('[poll] No settlement records returned this cycle.');
    return;
  }

  for (const record of records) {
    const result = classifyAndTranslate(record);
    if (!result) {
      console.log(`[poll] Skipping record with unclassified status: ${record.status} (settlementId=${record.settlementId || record.settlement_id})`);
      continue;
    }
    try {
      await producer.publish(result.topic, result.event);
    } catch (err) {
      console.error(`[poll] Failed to publish to ${result.topic}:`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function start() {
  try {
    await producer.connect();
  } catch (err) {
    console.error('[startup] Failed to connect Kafka producer:', err.message);
    process.exit(1);
  }

  // Begin polling loop
  console.log(`[startup] Starting settlement report polling every ${POLL_INTERVAL_MS}ms`);
  setInterval(() => {
    pollSettlementReports().catch((err) => {
      console.error('[poll] Unhandled error in polling cycle:', err.message);
    });
  }, POLL_INTERVAL_MS);

  // Run once immediately on startup
  pollSettlementReports().catch((err) => {
    console.error('[poll] Unhandled error in initial polling cycle:', err.message);
  });

  app.listen(PORT, () => {
    console.log(`[startup] settlement-provider listening on port ${PORT}`);
    console.log(`[startup] FOREIGN_API_BASE_URL = ${process.env.FOREIGN_API_BASE_URL || 'https://api.dtcc.com'}`);
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[shutdown] SIGTERM received, disconnecting Kafka producer...');
  try {
    await producer.disconnect();
  } catch (err) {
    console.error('[shutdown] Error disconnecting producer:', err.message);
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[shutdown] SIGINT received, disconnecting Kafka producer...');
  try {
    await producer.disconnect();
  } catch (err) {
    console.error('[shutdown] Error disconnecting producer:', err.message);
  }
  process.exit(0);
});

start();
