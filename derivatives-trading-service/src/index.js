'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const optionsRoutes = require('./routes/options');
const derivativesRoutes = require('./routes/derivatives');
const accountsRoutes = require('./routes/accounts');
const futuresRoutes = require('./routes/futures');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'derivatives-trading-service' });
});

// Domain routes
app.use('/', optionsRoutes);
app.use('/', derivativesRoutes);
app.use('/', accountsRoutes);
app.use('/', futuresRoutes);

// Error handler — must be mounted last
app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[derivatives-trading-service] Listening on port ${PORT}`);
});

module.exports = app;
