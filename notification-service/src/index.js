const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const producer = require('./producer');
const { startConsumer, disconnect: disconnectConsumer } = require('./consumer');

const app = express();

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'notification-service' });
});

// ─── Startup ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;

async function start() {
  try {
    await producer.connect();
    await startConsumer();

    app.listen(PORT, () => {
      console.log(`[notification-service] Listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('[notification-service] Fatal startup error:', error);
    process.exit(1);
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`[notification-service] Received ${signal} — shutting down gracefully`);
  try {
    await disconnectConsumer();
    await producer.disconnect();
    console.log('[notification-service] Clean shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('[notification-service] Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();

module.exports = app;
