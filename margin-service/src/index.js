'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const accountsRouter = require('./routes/accounts');
const tradesRouter = require('./routes/trades');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'margin-service' });
});

// Domain routes
app.use('/', accountsRouter);
app.use('/', tradesRouter);

// Error handler must be last
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`margin-service listening on port ${PORT}`);
});

module.exports = app;
