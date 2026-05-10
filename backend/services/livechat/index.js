const { createServiceApp, startService } = require('../_shared/app');
const { requireAuthOrService } = require('../_shared/auth');
const { normalizePhone } = require('../_shared/phone');
const { requestOrgId } = require('../_shared/tenant');
const { initDb, Conversation, ConversationNote } = require('./db');
require('dotenv').config();

const app = createServiceApp('livechat-service');
const port = process.env.LIVECHAT_PORT || 3008;

app.use(requireAuthOrService);

async function findOrCreateConversation(req, phone) {
  const normalized = normalizePhone(phone);
  const [conversation] = await Conversation.findOrCreate({
    where: { orgId: requestOrgId(req), phone: normalized },
    defaults: {
      orgId: requestOrgId(req),
      phone: normalized,
      contactId: req.body.contactId,
      lastMessageAt: new Date()
    }
  });
  return conversation;
}

app.get('/conversations', async (req, res, next) => {
  try {
    const where = { orgId: requestOrgId(req) };
    if (req.query.status) where.status = req.query.status;
    if (req.query.managerId) where.managerId = req.query.managerId;
    res.json(await Conversation.findAll({ where, include: [ConversationNote], order: [['updatedAt', 'DESC']] }));
  } catch (error) {
    next(error);
  }
});

app.post('/conversations/open', async (req, res, next) => {
  try {
    const conversation = await findOrCreateConversation(req, req.body.phone);
    await conversation.update({
      status: 'open',
      managerId: req.body.managerId ?? conversation.managerId,
      assignedTo: req.body.assignedTo ?? conversation.assignedTo,
      queue: req.body.queue ?? conversation.queue,
      closedAt: null,
      lastMessageAt: new Date()
    });
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

app.post('/conversations/:phone/status', async (req, res, next) => {
  try {
    const conversation = await findOrCreateConversation(req, req.params.phone);
    await conversation.update({
      status: req.body.openConversation ?? req.body.open_conversation ? 'open' : 'closed',
      managerId: req.body.manager ?? req.body.managerId ?? conversation.managerId,
      assignedTo: req.body.assignedTo ?? conversation.assignedTo,
      closedAt: req.body.openConversation ?? req.body.open_conversation ? null : new Date()
    });
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

app.post('/conversations/:phone/assign', async (req, res, next) => {
  try {
    const conversation = await findOrCreateConversation(req, req.params.phone);
    await conversation.update({
      managerId: req.body.managerId || null,
      assignedTo: req.body.assignedTo || null,
      status: 'open'
    });
    res.json(conversation);
  } catch (error) {
    next(error);
  }
});

app.post('/conversations/:phone/notes', async (req, res, next) => {
  try {
    const conversation = await findOrCreateConversation(req, req.params.phone);
    const note = await ConversationNote.create({
      orgId: requestOrgId(req),
      conversationId: conversation.id,
      author: req.body.author,
      body: req.body.body
    });
    res.status(201).json(note);
  } catch (error) {
    next(error);
  }
});

initDb()
  .then(() => startService(app, 'livechat-service', port))
  .catch((error) => {
    console.error('livechat-service failed to start', error);
    process.exit(1);
  });
