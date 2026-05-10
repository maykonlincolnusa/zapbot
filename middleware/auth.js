const jwt = require('jsonwebtoken');
const { Attendant, Workspace } = require('../models');
const { PRODUCT_SLUG } = require('../config/product');

const jwtSecret = () => process.env.JWT_SECRET || `${PRODUCT_SLUG}-dev-secret-change-me`;

const roleAliases = {
  support: 'attendant',
  marketer: 'manager'
};

const roleRank = {
  service: 100,
  owner: 50,
  admin: 40,
  manager: 30,
  attendant: 20,
  viewer: 10
};

function normalizeRole(role) {
  return roleAliases[role] || role || 'viewer';
}

function signToken(attendant) {
  return jwt.sign(
    {
      sub: attendant.id,
      email: attendant.email,
      role: attendant.role,
      workspaceId: attendant.workspaceId
    },
    jwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    const payload = jwt.verify(token, jwtSecret());
    const attendant = await Attendant.findByPk(payload.sub, { include: [Workspace] });

    if (!attendant || !attendant.active) {
      return res.status(401).json({ error: 'Inactive or missing attendant' });
    }

    req.user = attendant;
    req.workspace = attendant.Workspace;
    req.workspaceId = attendant.workspaceId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function attachJwtUser(req, token) {
  const payload = jwt.verify(token, jwtSecret());
  const attendant = await Attendant.findByPk(payload.sub, { include: [Workspace] });

  if (!attendant || !attendant.active) {
    const error = new Error('Inactive or missing attendant');
    error.status = 401;
    throw error;
  }

  req.user = attendant;
  req.workspace = attendant.Workspace;
  req.workspaceId = attendant.workspaceId;
}

function isServiceToken(token) {
  const allowed = [process.env.SERVICE_TOKEN, process.env.API_INTEGRATION_KEY]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  return token && allowed.includes(token);
}

async function attachServiceUser(req) {
  const workspace = await Workspace.findOne({
    where: { slug: process.env.DEFAULT_WORKSPACE_SLUG || 'default' }
  });

  if (!workspace) {
    const error = new Error('Default workspace is not initialized');
    error.status = 503;
    throw error;
  }

  req.user = {
    id: 'service',
    role: 'service',
    email: `service@${PRODUCT_SLUG}.local`,
    active: true,
    workspaceId: workspace.id
  };
  req.workspace = workspace;
  req.workspaceId = workspace.id;
}

async function requireServiceOrUserAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  try {
    if (isServiceToken(token)) {
      await attachServiceUser(req);
    } else {
      await attachJwtUser(req, token);
    }
    next();
  } catch (error) {
    res.status(error.status || 401).json({ error: error.status === 503 ? error.message : 'Invalid token' });
  }
}

async function requireQueryOrBearerAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const bearerToken = header.startsWith('Bearer ') ? header.slice(7) : null;
  const token = bearerToken || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }

  try {
    if (isServiceToken(token)) {
      await attachServiceUser(req);
    } else {
      await attachJwtUser(req, token);
    }
    next();
  } catch (error) {
    res.status(error.status || 401).json({ error: error.status === 503 ? error.message : 'Invalid token' });
  }
}

function tenantWhere(req, extra = {}) {
  return {
    ...extra,
    workspaceId: req.workspaceId
  };
}

function requireRole(...roles) {
  return (req, res, next) => {
    const userRole = normalizeRole(req.user?.role);
    const allowedRoles = roles.map(normalizeRole);
    const directMatch = allowedRoles.includes(userRole);
    const minimumRank = Math.min(...allowedRoles.map((role) => roleRank[role] || 0));
    const rankedMatch = roles.length === 1 && (roleRank[userRole] || 0) >= minimumRank;

    if (!req.user || (!directMatch && !rankedMatch)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireServiceOrUserAuth,
  requireQueryOrBearerAuth,
  requireRole,
  normalizeRole,
  tenantWhere,
  signToken
};
