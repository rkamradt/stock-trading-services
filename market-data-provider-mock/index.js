'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const responses = require('./responses.json');

const app = express();

// ─── In-memory state ─────────────────────────────────────────────────────────

let config = { failNext: false, statusCode: 500 };
const callLog = []; // { timestamp, method, path, headers, body }

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ─── Helper: record a call ────────────────────────────────────────────────────

function recordCall(req) {
  callLog.push({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body,
  });
}

// ─── Helper: maybe respond with simulated failure ────────────────────────────

function maybeFailNext(res) {
  if (config.failNext) {
    config.failNext = false;
    res.status(config.statusCode).json({ error: 'simulated failure' });
    return true;
  }
  return false;
}

// ─── Register foreign-API routes from responses.json ─────────────────────────
//
// Keys look like "GET /v1/quotes/{symbol}" — path params in {braces} are
// converted to Express :colon style so the router matches them correctly.

for (const key of Object.keys(responses)) {
  const spaceIdx = key.indexOf(' ');
  const method = key.slice(0, spaceIdx).toLowerCase(); // e.g. "get"
  const rawPath = key.slice(spaceIdx + 1);             // e.g. "/v1/quotes/{symbol}"

  // Convert {param} → :param for Express
  const expressPath = rawPath.replace(/\{([^}]+)\}/g, ':$1');

  const entry = responses[key];

  app[method](expressPath, (req, res) => {
    recordCall(req);
    if (maybeFailNext(res)) return;
    res.status(entry.status).json(entry.body);
  });
}

// ─── Mock-control routes ──────────────────────────────────────────────────────

/** Return the full call log for test assertions */
app.get('/mock/calls', (req, res) => {
  res.json(callLog);
});

/** Configure failure simulation, e.g. { failNext: true, statusCode: 503 } */
app.post('/mock/config', (req, res) => {
  Object.assign(config, req.body);
  res.json({ ok: true, config });
});

/** Clear the call log between tests */
app.delete('/mock/calls', (req, res) => {
  callLog.length = 0;
  res.json({ ok: true });
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'market-data-provider-mock' });
});

// ─── Start ────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`market-data-provider-mock listening on port ${PORT}`);
  console.log(`Serving ${Object.keys(responses).length} canned endpoint(s) from responses.json`);
});
