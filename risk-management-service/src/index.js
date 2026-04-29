'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const tradesRouter = require('./routes/trades');
const accountsRouter = require('./routes/accounts');
const portfoliosRouter = require('./routes/portfolios');
const stressTestsRouter = require('./routes/stress-tests');
const complianceRouter = require('./routes/compliance');
const alertsRouter = require('./routes/alerts');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'risk-management-service' });
});

// Domain routes
app.use(tradesRouter);
app.use(accountsRouter);
app.use(portfoliosRouter);
app.use(stressTestsRouter);
app.use(complianceRouter);
app.use(alertsRouter);

// Error handler — must be mounted last
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[risk-management-service] Listening on port ${PORT}`);
});

module.exports = app;
