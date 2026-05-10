const assert = require('node:assert/strict');
const test = require('node:test');
const request = require('supertest');

process.env.DISABLE_CRON = 'true';
process.env.DB_SYNC_ALTER = 'false';
process.env.RATE_LIMIT_PER_MINUTE = '10000';
process.env.AUTH_RATE_LIMIT = '10000';

const { app } = require('../server');
const { initDatabase, sequelize, Workspace, Attendant } = require('../models');

test.before(async () => {
  await initDatabase();
});

test.after(async () => {
  await sequelize.close();
});

test('health and readiness endpoints respond', async () => {
  const health = await request(app).get('/health').expect(200);
  assert.equal(health.body.ok, true);
  assert.ok(['sqlite', 'postgres'].includes(health.body.database));

  const ready = await request(app).get('/ready').expect(200);
  assert.equal(ready.body.ok, true);
});

test('auth rejects protected endpoints without token', async () => {
  await request(app).get('/api/contacts').expect(401);
});

test('register creates an isolated workspace and dashboard is tenant scoped', async () => {
  const email = `tenant-${Date.now()}@example.local`;
  const register = await request(app)
    .post('/api/auth/register')
    .send({
      name: 'Tenant Admin',
      company: 'Tenant Test Company',
      email,
      password: 'admin12345'
    })
    .expect(201);

  assert.ok(register.body.token);
  assert.ok(register.body.workspace.id);

  const token = register.body.token;
  await request(app)
    .post('/api/contacts')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: 'Lead Teste', phone: `5511999${Date.now()}`, tags: 'lead' })
    .expect(201);

  const dashboard = await request(app)
    .get('/api/dashboard')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  assert.equal(dashboard.body.contacts, 1);

  const healthCenter = await request(app)
    .get('/api/health-center')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  assert.equal(healthCenter.body.productName, process.env.PRODUCT_NAME || 'ZapBot');
  assert.ok(healthCenter.body.services.database);

  const workspace = await Workspace.findByPk(register.body.workspace.id);
  const attendant = await Attendant.findOne({ where: { email } });
  assert.equal(attendant.workspaceId, workspace.id);
});
