'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const accountsRouter = require('./routes/accounts');
const customersRouter = require('./routes/customers');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'account-service' });
});

// Domain routes
app.use('/', accountsRouter);
app.use('/', customersRouter);

// Error handler must be last
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[account-service] Listening on port ${PORT}`);
});

module.exports = app;
