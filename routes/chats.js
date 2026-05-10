const express = require('express');
const { Chat, Contact, Attendant, Message } = require('../models');
const { requireAuth, requireQueryOrBearerAuth, tenantWhere } = require('../middleware/auth');
const { sendAndRecordText } = require('../tasks/messaging');

const router = express.Router();

function chatInclude(messageLimit = 25) {
  return [
    Contact,
    { model: Attendant, as: 'assignedAttendant', attributes: ['id', 'name', 'email', 'role'] },
    { model: Message, limit: messageLimit, order: [['createdAt', 'DESC']] }
  ];
}

function whereForFilter(req) {
  const filter = req.query.filter || req.params.filter || 'all';
  if (filter === 'mine') return tenantWhere(req, { assignedAttendantId: req.user.id, status: 'open' });
  if (filter === 'unassigned') return tenantWhere(req, { assignedAttendantId: null, status: 'open' });
  return tenantWhere(req);
}

router.get('/events', requireQueryOrBearerAuth, async (req, res, next) => {
  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });

    async function sendSnapshot() {
      const [openChats, latestMessage] = await Promise.all([
        Chat.count({ where: tenantWhere(req, { status: 'open' }) }),
        Message.findOne({ where: tenantWhere(req), order: [['createdAt', 'DESC']] })
      ]);

      res.write(`event: chat_snapshot\n`);
      res.write(`data: ${JSON.stringify({ openChats, latestMessageId: latestMessage?.id || null, at: new Date().toISOString() })}\n\n`);
    }

    await sendSnapshot();
    const interval = setInterval(() => {
      sendSnapshot().catch(() => clearInterval(interval));
    }, Number(process.env.CHAT_SSE_INTERVAL_MS || 5000));

    req.on('close', () => clearInterval(interval));
  } catch (error) {
    next(error);
  }
});

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const chats = await Chat.findAll({
      where: whereForFilter(req),
      include: chatInclude(Number(req.query.messageLimit || 20)),
      order: [['lastMessageAt', 'DESC']],
      limit: Number(req.query.limit || 100)
    });
    res.json(chats);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      where: tenantWhere(req, { id: req.params.id }),
      include: chatInclude(Number(req.query.messageLimit || 50))
    });
    if (!chat) return res.status(404).json({ error: 'Conversa não encontrada' });
    res.json(chat);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/messages', async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!chat) return res.status(404).json({ error: 'Conversa não encontrada' });

    const messages = await Message.findAll({
      where: tenantWhere(req, { ChatId: chat.id }),
      order: [['createdAt', req.query.order === 'desc' ? 'DESC' : 'ASC']],
      limit: Number(req.query.limit || 100)
    });

    res.json(messages);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/claim', async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!chat) return res.status(404).json({ error: 'Conversa não encontrada' });

    await chat.update({ assignedAttendantId: req.user.id });
    res.json(await Chat.findOne({ where: tenantWhere(req, { id: chat.id }), include: chatInclude() }));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/unclaim', async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!chat) return res.status(404).json({ error: 'Conversa não encontrada' });

    await chat.update({ assignedAttendantId: null });
    res.json(await Chat.findOne({ where: tenantWhere(req, { id: chat.id }), include: chatInclude() }));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/messages', async (req, res, next) => {
  try {
    const chat = await Chat.findOne({
      where: tenantWhere(req, { id: req.params.id }),
      include: [Contact]
    });
    if (!chat) return res.status(404).json({ error: 'Conversa não encontrada' });
    if (!req.body.body) return res.status(400).json({ error: 'Mensagem é obrigatória' });

    const message = await sendAndRecordText(chat.Contact, req.body.body, {
      source: 'livechat',
      attendantId: req.user.id,
      chatId: chat.id
    });

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
