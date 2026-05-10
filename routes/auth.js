const express = require('express');
const bcrypt = require('bcryptjs');
const { Attendant, Workspace, slugify } = require('../models');
const { requireAuth, signToken } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');

const router = express.Router();
const allowedRoles = new Set(['owner', 'admin', 'manager', 'attendant', 'viewer']);

function publicAttendant(attendant) {
  return {
    id: attendant.id,
    name: attendant.name,
    email: attendant.email,
    role: attendant.role,
    active: attendant.active,
    workspaceId: attendant.workspaceId
  };
}

function publicWorkspace(workspace) {
  if (!workspace) return null;
  return {
    id: workspace.id,
    name: workspace.name,
    slug: workspace.slug,
    plan: workspace.plan,
    status: workspace.status
  };
}

router.post('/register', validateBody(schemas.authRegister), async (req, res, next) => {
  try {
    const { name, email, password, company, workspaceName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
    }

    const companyName = company || workspaceName || `${name} Workspace`;
    const baseSlug = slugify(companyName);
    let slug = baseSlug;
    let suffix = 1;

    while (await Workspace.findOne({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    const workspace = await Workspace.create({
      name: companyName,
      slug,
      plan: 'starter',
      status: 'active',
      settings: {}
    });

    const attendant = await Attendant.create({
      workspaceId: workspace.id,
      name,
      email,
      passwordHash: await bcrypt.hash(password, 10),
      role: 'admin'
    });

    res.status(201).json({
      token: signToken(attendant),
      user: publicAttendant(attendant),
      workspace: publicWorkspace(workspace)
    });
  } catch (error) {
    next(error);
  }
});

router.post('/login', validateBody(schemas.authLogin), async (req, res, next) => {
  try {
    const { email, password, workspaceSlug } = req.body;
    const include = workspaceSlug ? [{ model: Workspace, where: { slug: workspaceSlug } }] : [Workspace];
    const attendant = await Attendant.findOne({ where: { email }, include, order: [['updatedAt', 'DESC']] });

    if (!attendant || !(await bcrypt.compare(password || '', attendant.passwordHash))) {
      return res.status(401).json({ error: 'E-mail ou senha inválidos' });
    }

    if (!attendant.active) {
      return res.status(403).json({ error: 'Conta do atendente inativa' });
    }

    res.json({
      token: signToken(attendant),
      user: publicAttendant(attendant),
      workspace: publicWorkspace(attendant.Workspace)
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  const user = publicAttendant(req.user);
  res.json({
    user,
    workspace: publicWorkspace(req.workspace),
    permissions: {
      canManageSettings: ['owner', 'admin'].includes(user.role),
      canManageTeam: ['owner', 'admin'].includes(user.role),
      canManageAutomation: ['owner', 'admin', 'manager'].includes(user.role),
      canViewHealth: ['owner', 'admin', 'manager'].includes(user.role),
      roles: [...allowedRoles]
    }
  });
});

module.exports = router;
