const { createServiceApp, startService } = require('../_shared/app');
const { requireAuthOrService } = require('../_shared/auth');
const { normalizePhone } = require('../_shared/phone');
const { requestOrgId } = require('../_shared/tenant');
const { initDb, Segment, Broadcast, BroadcastJob } = require('./db');
require('dotenv').config();

const app = createServiceApp('broadcasts-service');
const port = process.env.BROADCASTS_PORT || 3009;

app.use(requireAuthOrService);

app.get('/segments', async (req, res, next) => {
  try {
    res.json(await Segment.findAll({ where: { orgId: requestOrgId(req) }, order: [['name', 'ASC']] }));
  } catch (error) {
    next(error);
  }
});

app.post('/segments', async (req, res, next) => {
  try {
    const segment = await Segment.create({
      orgId: requestOrgId(req),
      name: req.body.name,
      filters: req.body.filters || {}
    });
    res.status(201).json(segment);
  } catch (error) {
    next(error);
  }
});

app.get('/broadcasts', async (req, res, next) => {
  try {
    res.json(await Broadcast.findAll({ where: { orgId: requestOrgId(req) }, include: [Segment, BroadcastJob], order: [['updatedAt', 'DESC']] }));
  } catch (error) {
    next(error);
  }
});

app.post('/broadcasts', async (req, res, next) => {
  try {
    const broadcast = await Broadcast.create({
      orgId: requestOrgId(req),
      name: req.body.name,
      messageType: req.body.messageType || 'text',
      body: req.body.body,
      segmentId: req.body.segmentId || null,
      scheduledAt: req.body.scheduledAt,
      status: req.body.scheduledAt ? 'scheduled' : 'draft'
    });
    res.status(201).json(broadcast);
  } catch (error) {
    next(error);
  }
});

app.post('/broadcasts/:id/queue', async (req, res, next) => {
  try {
    const broadcast = await Broadcast.findOne({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    if (!broadcast) return res.sendStatus(404);

    const phones = (req.body.phones || []).map(normalizePhone).filter(Boolean);
    const jobs = [];
    for (const phone of phones) {
      jobs.push(
        await BroadcastJob.create({
          orgId: requestOrgId(req),
          broadcastId: broadcast.id,
          phone,
          status: 'queued'
        })
      );
    }

    await broadcast.update({
      status: 'queued',
      stats: { queued: jobs.length, sent: 0, failed: 0 }
    });

    res.json({ broadcast, jobs });
  } catch (error) {
    next(error);
  }
});

initDb()
  .then(() => startService(app, 'broadcasts-service', port))
  .catch((error) => {
    console.error('broadcasts-service failed to start', error);
    process.exit(1);
  });
