const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

function createServiceApp(serviceName, options = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  if (options.json !== false) {
    app.use(express.json({ limit: '2mb' }));
  }
  app.use(morgan(process.env.LOG_FORMAT || 'tiny'));
  app.use(
    cors({
      origin: (process.env.DASHBOARD_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
      credentials: true
    })
  );
  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 300)
    })
  );

  app.get('/health', (req, res) => {
    res.json({ ok: true, service: serviceName });
  });

  return app;
}

function startService(app, serviceName, port) {
  app.use((error, req, res, next) => {
    console.error(`[${serviceName}]`, error.response?.data || error.stack || error.message);
    res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
  });

  app.listen(port, () => {
    console.log(`${serviceName} listening on http://localhost:${port}`);
  });
}

module.exports = {
  createServiceApp,
  startService
};
