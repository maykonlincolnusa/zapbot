const { createServiceApp, startService } = require('../_shared/app');
const { requireAuthOrService } = require('../_shared/auth');
const { normalizePhone } = require('../_shared/phone');
const { requestOrgId } = require('../_shared/tenant');
const {
  initDb,
  Flow,
  ContactAutomationState,
  Sequence,
  Campaign,
  RobotField,
  SubscriberSequence,
  SubscriberCampaign
} = require('./db');
require('dotenv').config();

const app = createServiceApp('automation-service');
const port = process.env.AUTOMATION_PORT || 3003;

app.use(requireAuthOrService);

function getStep(flow, stepId) {
  const definition = flow.definition || {};
  const id = stepId || definition.start;
  return { id, step: definition.steps?.[id] };
}

async function sendFlowAction(req, phone, flow, stepId) {
  const { id, step } = getStep(flow, stepId);
  if (!step) {
    return { mode: 'flow-missing-step', messages: [], nextStepId: null };
  }

  const [state] = await ContactAutomationState.findOrCreate({
    where: { orgId: requestOrgId(req), phone },
    defaults: { orgId: requestOrgId(req), phone }
  });

  await state.update({
    activeFlowId: step.nextStepId ? flow.flowId : null,
    activeStepId: step.nextStepId || null
  });

  return {
    mode: 'flow',
    flowId: flow.flowId,
    sentStepId: id,
    nextStepId: step.nextStepId || null,
    messages: [{ type: 'text', body: step.prompt }]
  };
}

async function seedExampleFlow() {
  const count = await Flow.count();
  if (count > 0) return;

  await Flow.create({
    orgId: '1',
    flowId: 'welcome',
    name: 'Boas-vindas',
    trigger: 'oi',
    type: 'keyword',
    definition: {
      start: 'intro',
      steps: {
        intro: {
          prompt: 'Oi! Sou o assistente da plataforma. Posso ajudar com vendas, suporte ou falar com humano.',
          nextStepId: 'qualify'
        },
        qualify: {
          prompt: 'Qual e o seu principal objetivo hoje?',
          nextStepId: null
        }
      }
    }
  });
}

app.get('/flows', async (req, res, next) => {
  try {
    res.json(await Flow.findAll({ where: { orgId: requestOrgId(req) }, order: [['updatedAt', 'DESC']] }));
  } catch (error) {
    next(error);
  }
});

app.post('/flows', async (req, res, next) => {
  try {
    const flow = await Flow.create({
      orgId: requestOrgId(req),
      flowId: req.body.flowId,
      name: req.body.name,
      trigger: req.body.trigger?.toLowerCase(),
      type: req.body.type || 'keyword',
      definition: req.body.definition,
      active: req.body.active ?? true
    });
    res.status(201).json(flow);
  } catch (error) {
    next(error);
  }
});

app.put('/flows/:flowId', async (req, res, next) => {
  try {
    const flow = await Flow.findOne({ where: { orgId: requestOrgId(req), flowId: req.params.flowId } });
    if (!flow) return res.sendStatus(404);

    await flow.update({
      name: req.body.name ?? flow.name,
      trigger: req.body.trigger?.toLowerCase() ?? flow.trigger,
      type: req.body.type ?? flow.type,
      definition: req.body.definition ?? flow.definition,
      active: req.body.active ?? flow.active
    });
    res.json(flow);
  } catch (error) {
    next(error);
  }
});

app.post('/engine/start-flow', async (req, res, next) => {
  try {
    const flow = await Flow.findOne({ where: { orgId: requestOrgId(req), flowId: req.body.flowId, active: true } });
    if (!flow) return res.status(404).json({ error: 'Flow not found' });

    res.json(await sendFlowAction(req, normalizePhone(req.body.phone), flow, flow.definition?.start));
  } catch (error) {
    next(error);
  }
});

app.post('/engine/inbound', async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const text = String(req.body.text || '').trim();
    const lowerText = text.toLowerCase();

    const state = await ContactAutomationState.findOne({ where: { orgId: requestOrgId(req), phone } });
    if (state?.activeFlowId && state.activeStepId) {
      const flow = await Flow.findOne({ where: { orgId: requestOrgId(req), flowId: state.activeFlowId, active: true } });
      if (flow) return res.json(await sendFlowAction(req, phone, flow, state.activeStepId));
    }

    const campaign = await Campaign.findOne({
      where: { orgId: requestOrgId(req), triggerText: lowerText, active: true }
    });
    if (campaign) {
      return res.json({ mode: 'campaign', campaignId: campaign.campaignId, actions: campaign.actions, messages: [] });
    }

    const flow = await Flow.findOne({
      where: { orgId: requestOrgId(req), trigger: lowerText, active: true }
    });
    if (flow) return res.json(await sendFlowAction(req, phone, flow, flow.definition?.start));

    res.json({ mode: 'ai', messages: [], ai: true });
  } catch (error) {
    next(error);
  }
});

app.get('/sequences', async (req, res, next) => {
  try {
    res.json(await Sequence.findAll({ where: { orgId: requestOrgId(req) }, order: [['updatedAt', 'DESC']] }));
  } catch (error) {
    next(error);
  }
});

app.post('/sequences', async (req, res, next) => {
  try {
    const sequence = await Sequence.create({
      orgId: requestOrgId(req),
      sequenceId: req.body.sequenceId,
      name: req.body.name,
      steps: req.body.steps || [],
      active: req.body.active ?? true
    });
    res.status(201).json(sequence);
  } catch (error) {
    next(error);
  }
});

app.get('/campaigns', async (req, res, next) => {
  try {
    res.json(await Campaign.findAll({ where: { orgId: requestOrgId(req) }, order: [['updatedAt', 'DESC']] }));
  } catch (error) {
    next(error);
  }
});

app.post('/campaigns', async (req, res, next) => {
  try {
    const campaign = await Campaign.create({
      orgId: requestOrgId(req),
      campaignId: req.body.campaignId,
      name: req.body.name,
      triggerText: req.body.triggerText?.toLowerCase(),
      actions: req.body.actions || [],
      active: req.body.active ?? true
    });
    res.status(201).json(campaign);
  } catch (error) {
    next(error);
  }
});

app.get('/robot-fields', async (req, res, next) => {
  try {
    res.json(await RobotField.findAll({ where: { orgId: requestOrgId(req) }, order: [['key', 'ASC']] }));
  } catch (error) {
    next(error);
  }
});

app.post('/robot-fields', async (req, res, next) => {
  try {
    const [field] = await RobotField.findOrCreate({
      where: { orgId: requestOrgId(req), key: req.body.key },
      defaults: { orgId: requestOrgId(req), key: req.body.key, type: req.body.type ?? 0, value: req.body.value }
    });
    await field.update({ value: req.body.value, type: req.body.type ?? field.type });
    res.status(201).json(field);
  } catch (error) {
    next(error);
  }
});

app.post('/robot-fields/:id/value', async (req, res, next) => {
  try {
    const field = await RobotField.findOne({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    if (!field) return res.sendStatus(404);
    await field.update({ value: req.body.value });
    res.json(field);
  } catch (error) {
    next(error);
  }
});

app.post('/subscribers/:phone/sequences/:sequenceId', async (req, res, next) => {
  try {
    const [subscription] = await SubscriberSequence.findOrCreate({
      where: { orgId: requestOrgId(req), phone: normalizePhone(req.params.phone), sequenceId: req.params.sequenceId },
      defaults: { orgId: requestOrgId(req), phone: normalizePhone(req.params.phone), sequenceId: req.params.sequenceId }
    });
    await subscription.update({ status: 'active' });
    res.status(201).json(subscription);
  } catch (error) {
    next(error);
  }
});

app.delete('/subscribers/:phone/sequences/:sequenceId', async (req, res, next) => {
  try {
    const deleted = await SubscriberSequence.destroy({
      where: { orgId: requestOrgId(req), phone: normalizePhone(req.params.phone), sequenceId: req.params.sequenceId }
    });
    res.status(deleted ? 204 : 404).send();
  } catch (error) {
    next(error);
  }
});

app.post('/subscribers/:phone/campaigns/:campaignId', async (req, res, next) => {
  try {
    const [subscription] = await SubscriberCampaign.findOrCreate({
      where: { orgId: requestOrgId(req), phone: normalizePhone(req.params.phone), campaignId: req.params.campaignId },
      defaults: { orgId: requestOrgId(req), phone: normalizePhone(req.params.phone), campaignId: req.params.campaignId }
    });
    await subscription.update({ status: 'active' });
    res.status(201).json(subscription);
  } catch (error) {
    next(error);
  }
});

app.delete('/subscribers/:phone/campaigns/:campaignId', async (req, res, next) => {
  try {
    const deleted = await SubscriberCampaign.destroy({
      where: { orgId: requestOrgId(req), phone: normalizePhone(req.params.phone), campaignId: req.params.campaignId }
    });
    res.status(deleted ? 204 : 404).send();
  } catch (error) {
    next(error);
  }
});

initDb()
  .then(seedExampleFlow)
  .then(() => startService(app, 'automation-service', port))
  .catch((error) => {
    console.error('automation-service failed to start', error);
    process.exit(1);
  });
