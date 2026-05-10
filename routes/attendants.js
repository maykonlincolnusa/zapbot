const express = require('express');
const bcrypt = require('bcryptjs');
const { Attendant, Chat, Contact, Message } = require('../models');
const { requireAuth, requireRole, tenantWhere } = require('../middleware/auth');
const { sendAndRecordText } = require('../tasks/messaging');

const router = express.Router();
router.use(requireAuth);
const assignableRoles = new Set(['owner', 'admin', 'manager', 'attendant', 'viewer']);

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

function chatInclude() {
  return [
    Contact,
    { model: Attendant, as: 'assignedAttendant', attributes: ['id', 'name', 'email', 'role'] },
    { model: Message, limit: 20, order: [['createdAt', 'DESC']] }
  ];
}

router.get('/', requireRole('manager'), async (req, res, next) => {
  try {
    const attendants = await Attendant.findAll({ where: tenantWhere(req), order: [['name', 'ASC']] });
    res.json(attendants.map(publicAttendant));
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' });
    }

    const nextRole = assignableRoles.has(role) ? role : 'attendant';

    const attendant = await Attendant.create({
      name,
      email,
      workspaceId: req.workspaceId,
      passwordHash: await bcrypt.hash(password, 10),
      role: nextRole
    });

    res.status(201).json(publicAttendant(attendant));
  } catch (error) {
    next(error);
  }
});

router.get('/chats/unassigned', async (req, res, next) => {
  try {
    const chats = await Chat.findAll({
      where: tenantWhere(req, { assignedAttendantId: null, status: 'open' }),
      include: chatInclude(),
      order: [['lastMessageAt', 'DESC']]
    });
    res.json(chats);
  } catch (error) {
    next(error);
  }
});

router.get('/chats/mine', async (req, res, next) => {
  try {
    const chats = await Chat.findAll({
      where: tenantWhere(req, { assignedAttendantId: req.user.id, status: 'open' }),
      include: chatInclude(),
      order: [['lastMessageAt', 'DESC']]
    });
    res.json(chats);
  } catch (error) {
    next(error);
  }
});

router.get('/chats/all', requireRole('manager'), async (req, res, next) => {
  try {
    const chats = await Chat.findAll({
      where: tenantWhere(req),
      include: chatInclude(),
      order: [['lastMessageAt', 'DESC']]
    });
    res.json(chats);
  } catch (error) {
    next(error);
  }
});

router.post('/chats/:chatId/assign', async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ where: tenantWhere(req, { id: req.params.chatId }) });
    if (!chat) return res.status(404).json({ error: 'Conversa não encontrada' });

    const attendantId = req.body.attendantId || req.user.id;
    const attendant = await Attendant.findOne({ where: tenantWhere(req, { id: attendantId }) });
    if (!attendant) return res.status(404).json({ error: 'Atendente não encontrado' });

    await chat.update({ assignedAttendantId: attendant.id });
    res.json(await Chat.findOne({ where: tenantWhere(req, { id: chat.id }), include: chatInclude() }));
  } catch (error) {
    next(error);
  }
});

router.post('/chats/:chatId/transfer', requireRole('manager'), async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ where: tenantWhere(req, { id: req.params.chatId }) });
    if (!chat) return res.status(404).json({ error: 'Conversa não encontrada' });

    const attendant = await Attendant.findOne({ where: tenantWhere(req, { id: req.body.attendantId }) });
    if (!attendant) return res.status(404).json({ error: 'Atendente de destino não encontrado' });

    await chat.update({ assignedAttendantId: attendant.id });
    res.json(await Chat.findOne({ where: tenantWhere(req, { id: chat.id }), include: chatInclude() }));
  } catch (error) {
    next(error);
  }
});

router.post('/chats/:chatId/messages', async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ where: tenantWhere(req, { id: req.params.chatId }), include: [Contact] });
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

router.post('/chats/:chatId/unassign', async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ where: tenantWhere(req, { id: req.params.chatId }) });
    if (!chat) return res.status(404).json({ error: 'Conversa não encontrada' });

    await chat.update({ assignedAttendantId: null });
    res.json(await Chat.findOne({ where: tenantWhere(req, { id: chat.id }), include: chatInclude() }));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
