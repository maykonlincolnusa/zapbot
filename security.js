const crypto = require('crypto');
const compression = require('compression');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const pino = require('pino');
const pinoHttp = require('pino-http');

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.token',
      'req.body.apiKey',
      'res.headers["set-cookie"]'
    ],
    censor: '[REDACTED]'
  }
});

function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

function secureCors() {
  const allowedOrigins = parseOrigins(
    process.env.CORS_ORIGINS ||
      process.env.DASHBOARD_ORIGIN ||
      'http://localhost:5173,http://127.0.0.1:5173'
  );

  return cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('CORS origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-Id'],
    maxAge: 600
  });
}

function apiRateLimiter() {
  return rateLimit({
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000),
    limit: Number(process.env.RATE_LIMIT_PER_MINUTE || 300),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many requests' }
  });
}

function authRateLimiter() {
  return rateLimit({
    windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60_000),
    limit: Number(process.env.AUTH_RATE_LIMIT || 20),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Too many authentication attempts' }
  });
}

function webhookRateLimiter() {
  return rateLimit({
    windowMs: Number(process.env.WEBHOOK_RATE_LIMIT_WINDOW_MS || 60_000),
    limit: Number(process.env.WEBHOOK_RATE_LIMIT || 1200),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Webhook rate limit exceeded' }
  });
}

function applySecurity(app) {
  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));
  app.use(requestId);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.id,
      customProps: (req) => ({ requestId: req.id })
    })
  );
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    })
  );
  app.use(secureCors());
  app.use(compression());
}

module.exports = {
  applySecurity,
  apiRateLimiter,
  authRateLimiter,
  webhookRateLimiter,
  logger
};
