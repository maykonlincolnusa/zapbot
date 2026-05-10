const { requireAuthOrService } = require('./auth');
require('dotenv').config();

function requireApiKey(req, res, next) {
  const apiKey = req.headers['api-key'] || req.headers['x-api-key'];
  if (apiKey && apiKey === (process.env.API_INTEGRATION_KEY || 'dev-api-key')) {
    req.integration = true;
    req.user = {
      orgId: req.headers['x-org-id'] || process.env.DEFAULT_ORG_ID || '1',
      role: 'integration'
    };
    return next();
  }

  return res.status(403).json({ error_message: 'API-KEY is invalid' });
}

function requireApiKeyOrAuth(req, res, next) {
  const apiKey = req.headers['api-key'] || req.headers['x-api-key'];
  if (apiKey) return requireApiKey(req, res, next);
  return requireAuthOrService(req, res, next);
}

module.exports = {
  requireApiKey,
  requireApiKeyOrAuth
};
