const bcrypt = require('bcryptjs');
const { createServiceApp, startService } = require('../_shared/app');
const { requireAuth, signUserToken } = require('../_shared/auth');
const { initDb, Organization, User } = require('./db');
require('dotenv').config();

const app = createServiceApp('auth-service');
const port = process.env.AUTH_PORT || 3001;

function publicUser(user) {
  return {
    id: user.id,
    orgId: user.orgId,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

app.post('/register', async (req, res, next) => {
  try {
    const { companyName, name, email, password } = req.body;
    if (!companyName || !name || !email || !password) {
      return res.status(400).json({ error: 'companyName, name, email and password are required' });
    }

    const existing = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const organization = await Organization.create({ name: companyName });
    const user = await User.create({
      orgId: organization.id,
      name,
      email: email.toLowerCase(),
      passwordHash: await bcrypt.hash(password, 12),
      role: 'owner'
    });

    res.status(201).json({
      token: signUserToken(user),
      user: publicUser(user),
      organization
    });
  } catch (error) {
    next(error);
  }
});

app.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email: String(email || '').toLowerCase() } });
    if (!user || !(await bcrypt.compare(password || '', user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const organization = await Organization.findByPk(user.orgId);
    res.json({
      token: signUserToken(user),
      user: publicUser(user),
      organization
    });
  } catch (error) {
    next(error);
  }
});

app.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.sub);
    if (!user) return res.sendStatus(404);

    const organization = await Organization.findByPk(user.orgId);
    res.json({ user: publicUser(user), organization });
  } catch (error) {
    next(error);
  }
});

initDb()
  .then(() => startService(app, 'auth-service', port))
  .catch((error) => {
    console.error('auth-service failed to start', error);
    process.exit(1);
  });
