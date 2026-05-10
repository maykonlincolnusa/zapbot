require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');

const models = require('./models');
const { initDatabase, getDefaultWorkspace, dialect, Contact, Flow, FlowSession, Chat, Message, Attendant } = models;
const { requireAuth } = require('./middleware/auth');
const { verifyWebhook } = require('./whatsapp');
const { generateAIResponse } = require('./ai/assistant');
const { startFlow, processFlowMessage } = require('./flowEngine');
const { findOrCreateOpenChat, sendAndRecordText } = require('./tasks/messaging');
const { startSequenceScheduler } = require('./tasks/sequences');
const { startBroadcastScheduler } = require('./tasks/broadcasts');
const { applySecurity, apiRateLimiter, authRateLimiter, webhookRateLimiter, logger } = require('./security');
const { handleWhatsAppWebhook } = require('./webhookHandler');

const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const flowRoutes = require('./routes/flows');
const sequenceRoutes = require('./routes/sequences');
const broadcastRoutes = require('./routes/broadcasts');
const attendantRoutes = require('./routes/attendants');
const ragRoutes = require('./routes/rag');
const aiRoutes = require('./routes/ai');
const chatRoutes = require('./routes/chats');
const integrationRoutes = require('./routes/integrations');
const mcpRoutes = require('./routes/mcp');
const transmissionRoutes = require('./routes/transmissions');
const healthRoutes = require('./routes/health');
const { PRODUCT_NAME } = require('./config/product');

const app = express();

applySecurity(app);
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));

async function seedAdminFromEnv() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) return;

  const workspace = await getDefaultWorkspace();
  const existing = await Attendant.findOne({ where: { workspaceId: workspace.id, email: process.env.ADMIN_EMAIL } });
  if (existing) return;

  await Attendant.create({
    workspaceId: workspace.id,
    name: process.env.ADMIN_NAME || `${PRODUCT_NAME} Admin`,
    email: process.env.ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 10),
    role: 'admin'
  });
}

async function findTriggeredFlow(workspaceId, text) {
  const normalized = String(text || '').trim().toLowerCase();
  if (!normalized) return null;

  const flows = await Flow.findAll({
    where: {
      active: true,
      workspaceId,
      trigger: { [Op.ne]: null }
    }
  });

  return flows.find((flow) => {
    const trigger = String(flow.trigger || '').trim().toLowerCase();
    return trigger && normalized.includes(trigger);
  });
}

async function recordInboundMessage(contact, incoming) {
  const chat = await findOrCreateOpenChat(contact);

  const message = await Message.create({
    ChatId: chat.id,
    ContactId: contact.id,
    workspaceId: contact.workspaceId,
    direction: 'inbound',
    body: incoming.text || `[${incoming.type}]`,
    whatsappMessageId: incoming.id,
    status: 'received',
    metadata: incoming.raw
  });

  await chat.update({ lastMessageAt: new Date() });
  return { chat, message };
}

async function processIncomingWhatsAppMessage(incoming) {
  if (!incoming.from) return null;
  const workspace = await getDefaultWorkspace();

  const [contact] = await Contact.findOrCreate({
    where: { workspaceId: workspace.id, phone: incoming.from },
    defaults: {
      workspaceId: workspace.id,
      phone: incoming.from,
      name: incoming.raw?.profile?.name || incoming.from,
      tags: ['whatsapp'],
      metadata: { source: 'whatsapp_cloud_api' }
    }
  });

  await recordInboundMessage(contact, incoming);

  const activeSession = await FlowSession.findOne({
    where: { workspaceId: workspace.id, ContactId: contact.id, active: true },
    order: [['updatedAt', 'DESC']]
  });

  let reply = '';
  let metadata = { source: 'webhook' };

  if (activeSession) {
    const result = await processFlowMessage({
      models,
      session: activeSession,
      userMessage: incoming.text
    });

    if (result.handled) {
      reply = result.reply;
      metadata = {
        ...metadata,
        source: 'flow',
        flowSessionId: activeSession.id,
        completed: result.completed
      };
    }
  }

  if (!reply) {
    const triggeredFlow = await findTriggeredFlow(workspace.id, incoming.text);
    if (triggeredFlow) {
      const result = await startFlow({
        models,
        workspaceId: workspace.id,
        contactId: contact.id,
        flow: triggeredFlow
      });
      reply = result.reply;
      metadata = {
        ...metadata,
        source: 'flow',
        flowId: triggeredFlow.id
      };
    }
  }

  if (!reply && process.env.OPENAI_AUTO_REPLY !== 'false') {
    reply = await generateAIResponse(incoming.text, {
      contact: {
        id: contact.id,
        name: contact.name,
        tags: contact.tags
      },
      workspaceId: workspace.id
    });
    metadata = {
      ...metadata,
      source: 'ai'
    };
  }

  if (reply) {
    await sendAndRecordText(contact, reply, metadata);
  }

  return { contactId: contact.id, replied: Boolean(reply) };
}

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    name: PRODUCT_NAME,
    database: dialect,
    whatsappConfigured: Boolean(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
    mcpConfigured: Boolean(process.env.SERVICE_TOKEN || process.env.API_INTEGRATION_KEY),
    integrationsConfigured: Boolean(process.env.CRM_BASE_URL || process.env.PAYMENT_GATEWAY_URL)
  });
});

app.get('/ready', async (req, res) => {
  try {
    await models.sequelize.authenticate();
    res.json({ ok: true, database: dialect });
  } catch (error) {
    req.log?.error({ error }, 'Readiness check failed');
    res.status(503).json({ ok: false, error: 'Banco de dados indisponível' });
  }
});

app.get('/webhook', webhookRateLimiter(), (req, res) => {
  const challenge = verifyWebhook(req.query);

  if (!challenge) {
    return res.sendStatus(403);
  }

  res.status(200).send(challenge);
});

app.post('/webhook', webhookRateLimiter(), async (req, res, next) => {
  try {
    await handleWhatsAppWebhook(req.body, {
      processIncomingMessage: processIncomingWhatsAppMessage
    });
    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

app.get('/api/dashboard', requireAuth, async (req, res, next) => {
  try {
    const [contacts, flows, chats, attendants] = await Promise.all([
      Contact.count({ where: { workspaceId: req.workspaceId } }),
      Flow.count({ where: { workspaceId: req.workspaceId } }),
      Chat.count({ where: { workspaceId: req.workspaceId, status: 'open' } }),
      Attendant.count({ where: { workspaceId: req.workspaceId, active: true } })
    ]);

    res.json({ contacts, flows, openChats: chats, attendants });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRateLimiter(), authRoutes);
app.use('/api', apiRateLimiter());
app.use('/api/contacts', contactRoutes);
app.use('/api/automation/flows', flowRoutes);
app.use('/api/automation/sequences', sequenceRoutes);
app.use('/api/automation/broadcasts', broadcastRoutes);
app.use('/api/automation/transmissions', transmissionRoutes);
app.use('/api/inbox', attendantRoutes);
app.use('/api/team', attendantRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/flows', flowRoutes);
app.use('/api/sequences', sequenceRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/transmissions', transmissionRoutes);
app.use('/api/attendants', attendantRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/mcp', mcpRoutes);
app.use('/api/health-center', healthRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
  req.log?.error({ error }, 'Request failed');
  const status = error.status || 500;
  res.status(error.status || 500).json({
    error: process.env.NODE_ENV === 'production' && status >= 500 ? 'Internal server error' : error.message || 'Internal server error',
    code: error.code || (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
    details: error.details,
    requestId: req.id
  });
});

async function start() {
  await initDatabase();
  await seedAdminFromEnv();

  startSequenceScheduler();
  startBroadcastScheduler();

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    logger.info(`${PRODUCT_NAME} API running on http://localhost:${port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    logger.error({ error }, `Failed to start ${PRODUCT_NAME}`);
    process.exit(1);
  });
}

module.exports = {
  app,
  start,
  processIncomingWhatsAppMessage
};
