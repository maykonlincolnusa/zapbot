const axios = require('axios');
const { createServiceApp, startService } = require('../_shared/app');
const { requireAuthOrService } = require('../_shared/auth');
const { requireApiKeyOrAuth } = require('../_shared/apiKey');
const { requestOrgId } = require('../_shared/tenant');
const { initDb, Integration, IntegrationEvent } = require('./db');
require('dotenv').config();

const app = createServiceApp('integrations-service');
const port = process.env.INTEGRATIONS_PORT || 3010;

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use('/inbound', requireApiKeyOrAuth);
app.post('/inbound/:eventType', async (req, res, next) => {
  try {
    const event = await IntegrationEvent.create({
      orgId: requestOrgId(req),
      direction: 'inbound',
      eventType: req.params.eventType,
      status: 'received',
      payload: req.body
    });
    res.status(202).json(event);
  } catch (error) {
    next(error);
  }
});

app.use(requireAuthOrService);

app.get('/integrations', async (req, res, next) => {
  try {
    res.json(await Integration.findAll({ where: { orgId: requestOrgId(req) }, order: [['updatedAt', 'DESC']] }));
  } catch (error) {
    next(error);
  }
});

app.post('/integrations', async (req, res, next) => {
  try {
    const integration = await Integration.create({
      orgId: requestOrgId(req),
      name: req.body.name,
      type: req.body.type || 'outbound_webhook',
      url: req.body.url,
      secret: req.body.secret,
      active: req.body.active ?? true,
      mapping: req.body.mapping || {}
    });
    res.status(201).json(integration);
  } catch (error) {
    next(error);
  }
});

app.post('/integrations/:id/trigger', async (req, res, next) => {
  try {
    const integration = await Integration.findOne({ where: { id: req.params.id, orgId: requestOrgId(req), active: true } });
    if (!integration) return res.sendStatus(404);

    const event = await IntegrationEvent.create({
      orgId: requestOrgId(req),
      integrationId: integration.id,
      direction: 'outbound',
      eventType: req.body.eventType || 'manual',
      status: 'queued',
      payload: req.body.payload || {}
    });

    if (!integration.url || process.env.INTEGRATIONS_DRY_RUN !== 'false') {
      await event.update({ status: 'dry_run', response: { dryRun: true } });
      return res.json(event);
    }

    const response = await axios.post(integration.url, req.body.payload || {}, {
      timeout: 10000,
      headers: integration.secret ? { 'x-integration-secret': integration.secret } : {}
    });
    await event.update({ status: 'sent', response: response.data });
    res.json(event);
  } catch (error) {
    next(error);
  }
});

app.get('/events', async (req, res, next) => {
  try {
    res.json(await IntegrationEvent.findAll({ where: { orgId: requestOrgId(req) }, include: [Integration], order: [['createdAt', 'DESC']] }));
  } catch (error) {
    next(error);
  }
});

initDb()
  .then(() => startService(app, 'integrations-service', port))
  .catch((error) => {
    console.error('integrations-service failed to start', error);
    process.exit(1);
  });
