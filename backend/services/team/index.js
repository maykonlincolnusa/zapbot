const { createServiceApp, startService } = require('../_shared/app');
const { requireAuthOrService } = require('../_shared/auth');
const { requestOrgId } = require('../_shared/tenant');
const { initDb, Manager } = require('./db');
require('dotenv').config();

const app = createServiceApp('team-service');
const port = process.env.TEAM_PORT || 3007;

app.use(requireAuthOrService);

function managerPayload(req) {
  return {
    orgId: requestOrgId(req),
    email: String(req.body.email || '').toLowerCase(),
    fullName: req.body.fullName || req.body.full_name,
    dashboard: req.body.dashboard ?? true,
    campaigns: req.body.campaigns ?? true,
    audience: req.body.audience ?? true,
    assignChat: req.body.assignChat ?? req.body.assign_chat ?? 1,
    automation: req.body.automation ?? true,
    flows: req.body.flows ?? true,
    settings: req.body.settings ?? false,
    liveChat: req.body.liveChat ?? req.body.live_chat ?? true,
    liveChatAll: req.body.liveChatAll ?? req.body.live_chat_all ?? false,
    liveChatMyBusy: req.body.liveChatMyBusy ?? req.body.live_chat_my_busy ?? true,
    liveChatAllBusy: req.body.liveChatAllBusy ?? req.body.live_chat_all_busy ?? false,
    broadcasts: req.body.broadcasts ?? false,
    addingNewManagers: req.body.addingNewManagers ?? req.body.adding_new_managers ?? false,
    onlineStatus: req.body.onlineStatus || req.body.online_status || 'offline'
  };
}

app.get('/managers', async (req, res, next) => {
  try {
    res.json(await Manager.findAll({ where: { orgId: requestOrgId(req) }, order: [['email', 'ASC']] }));
  } catch (error) {
    next(error);
  }
});

app.post('/managers', async (req, res, next) => {
  try {
    if (!req.body.email) return res.status(400).json({ error: 'email is required' });
    const manager = await Manager.create(managerPayload(req));
    res.status(201).json(manager);
  } catch (error) {
    next(error);
  }
});

app.get('/managers/:id', async (req, res, next) => {
  try {
    const manager = await Manager.findOne({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    if (!manager) return res.sendStatus(404);
    res.json(manager);
  } catch (error) {
    next(error);
  }
});

app.patch('/managers/:id', async (req, res, next) => {
  try {
    const manager = await Manager.findOne({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    if (!manager) return res.sendStatus(404);
    await manager.update({ ...managerPayload(req), email: req.body.email ? String(req.body.email).toLowerCase() : manager.email });
    res.json(manager);
  } catch (error) {
    next(error);
  }
});

app.delete('/managers/:id', async (req, res, next) => {
  try {
    const deleted = await Manager.destroy({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    res.status(deleted ? 204 : 404).send();
  } catch (error) {
    next(error);
  }
});

initDb()
  .then(() => startService(app, 'team-service', port))
  .catch((error) => {
    console.error('team-service failed to start', error);
    process.exit(1);
  });
