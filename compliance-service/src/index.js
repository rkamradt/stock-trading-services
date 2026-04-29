'use strict';

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const reportsRouter = require('./routes/reports');
const auditTrailsRouter = require('./routes/audit-trails');
const surveillanceRouter = require('./routes/surveillance');
const bestExecutionRouter = require('./routes/best-execution');
const largeTraderRouter = require('./routes/large-trader');
const suspiciousActivityRouter = require('./routes/suspicious-activity');
const rulesRouter = require('./routes/rules');
const violationsRouter = require('./routes/violations');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'compliance-service' });
});

app.use(reportsRouter);
app.use(auditTrailsRouter);
app.use(surveillanceRouter);
app.use(bestExecutionRouter);
app.use(largeTraderRouter);
app.use(suspiciousActivityRouter);
app.use(rulesRouter);
app.use(violationsRouter);

app.use(errorHandler);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`compliance-service listening on port ${PORT}`);
});

module.exports = app;
