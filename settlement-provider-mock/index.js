'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const responses = require('./responses.json');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(morgan('combined'));

// ── In-memory state ───────────────────────────────────────────────────────────
let config = { failNext: false, statusCode: 500 };
const callLog = []; // { timestamp, method, path, headers, body }

// ── Helper: record every inbound foreign-API call ─────────────────────────────
function recordCall(req) {
  callLog.push({
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.path,
    headers: req.headers,
    body: req.body,
  });
}

// ── Helper: attempt a simulated failure before serving a canned response ──────
function tryFailNext(res, cannedStatus, cannedBody) {
  if (config.failNext) {
    const failStatus = config.statusCode;
    config.failNext = false;
    return res.status(failStatus).json({ error: 'simulated failure' });
  }
  return res.status(cannedStatus).json(cannedBody);
}

// ── Dynamically register one Express route per responses.json key ─────────────
//
// Key format: "METHOD /v1/some/path/{paramName}"
// Path params expressed as {paramName} in the JSON key are converted to
// Express-style :paramName placeholders.
//
for (const key of Object.keys(responses)) {
  const spaceIdx = key.indexOf(' ');
  if (spaceIdx === -1) {
    console.warn(`[mock] Skipping malformed responses.json key: "${key}"`);
    continue;
  }

  const method = key.slice(0, spaceIdx).toLowerCase();      // e.g. "post"
  const rawPath = key.slice(spaceIdx + 1);                  // e.g. "/v1/settlement/instructions/{instructionId}"
  const expressPath = rawPath.replace(/\{([^}]+)\}/g, ':$1'); // → "/v1/settlement/instructions/:instructionId"

  const { status, body } = responses[key];

  if (typeof app[method] !== 'function') {
    console.warn(`[mock] Unsupported HTTP method "${method}" for key "${key}" — skipping.`);
    continue;
  }

  app[method](expressPath, (req, res) => {
    recordCall(req);
    tryFailNext(res, status, body);
  });

  console.log(`[mock] Registered ${method.toUpperCase()} ${expressPath}`);
}

// ── Mock-control endpoints ────────────────────────────────────────────────────

// GET /mock/calls — return the full call log for test assertions
app.get('/mock/calls', (req, res) => {
  res.json(callLog);
});

// POST /mock/config — configure failure simulation at runtime
// Body example: { "failNext": true, "statusCode": 503 }
app.post('/mock/config', (req, res) => {
  Object.assign(config, req.body);
  res.json({ ok: true, config });
});

// DELETE /mock/calls — clear the call log between tests
app.delete('/mock/calls', (req, res) => {
  callLog.length = 0;
  res.json({ ok: true });
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'settlement-provider-mock' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[mock] settlement-provider-mock listening on port ${PORT}`);
});
