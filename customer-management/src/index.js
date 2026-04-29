'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const customerRoutes = require('./routes/customers');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── Core middleware ──────────────────────────────────────────────────────────
app.use(cors());
app.use(morgan(process.env.LOG_FORMAT || 'combined'));
app.use(express.json());

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'customer-management' });
});

// ── Domain routes ─────────────────────────────────────────────────────────────
app.use('/', customerRoutes);

// ── Error handler (must be last) ──────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[customer-management] Service listening on port ${PORT} (env: ${process.env.NODE_ENV || 'development'})`);
});

module.exports = app; // exported for testing
