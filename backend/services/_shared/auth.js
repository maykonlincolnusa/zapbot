const jwt = require('jsonwebtoken');
require('dotenv').config();

function signUserToken(user) {
  return jwt.sign(
    {
      sub: String(user.id),
      orgId: String(user.orgId),
      email: user.email,
      role: user.role || 'admin'
    },
    process.env.JWT_SECRET || 'dev-secret-change-me',
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

function readBearerToken(req) {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length);
}

function requireAuth(req, res, next) {
  try {
    const token = readBearerToken(req);
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });

    req.user = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-change-me');
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAuthOrService(req, res, next) {
  const serviceToken = req.headers['x-service-token'];
  if (serviceToken && serviceToken === (process.env.SERVICE_TOKEN || 'dev-service-token')) {
    req.service = true;
    req.user = {
      orgId: req.headers['x-org-id'] || process.env.DEFAULT_ORG_ID || '1',
      role: 'service'
    };
    return next();
  }

  return requireAuth(req, res, next);
}

module.exports = {
  signUserToken,
  requireAuth,
  requireAuthOrService
};
