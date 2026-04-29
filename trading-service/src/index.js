'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const ordersRouter = require('./routes/orders');
const accountsRouter = require('./routes/accounts');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'trading-service' });
});

// Domain routes
app.use('/', ordersRouter);
app.use('/', accountsRouter);

// Error handler — must be last
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[trading-service] Listening on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
});

module.exports = app;
