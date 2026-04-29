'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const reportsRouter = require('./routes/reports');
const accountsRouter = require('./routes/accounts');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'reporting-service' });
});

// Domain routes
app.use('/', reportsRouter);
app.use('/', accountsRouter);

// Error handler must be mounted last
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[reporting-service] Listening on port ${PORT}`);
});

module.exports = app;
