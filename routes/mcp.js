const express = require('express');
const { Op } = require('sequelize');
const { Chat, Contact, Attendant, Message, dialect } = require('../models');
const { requireServiceOrUserAuth, tenantWhere } = require('../middleware/auth');
const { sendAndRecordMedia, sendAndRecordText } = require('../tasks/messaging');
const { PRODUCT_NAME, PRODUCT_SLUG } = require('../config/product');

const router = express.Router();
router.use(requireServiceOrUserAuth);

const likeOperator = dialect === 'postgres' ? Op.iLike : Op.like;

function chatInclude(messageLimit = 20) {
  return [
    Contact,
    { model: Attendant, as: 'assignedAttendant', attributes: ['id', 'name', 'email', 'role'] },
    { model: Message, limit: messageLimit, order: [['createdAt', 'DESC']] }
  ];
}

async function resolveContact(req, payload) {
  if (payload.chatId) {
    const chat = await Chat.findOne({
      where: tenantWhere(req, { id: payload.chatId }),
      include: [Contact]
    });
    if (!chat) return null;
    return chat.Contact;
  }

  if (payload.contactId) {
    return Contact.findOne({ where: tenantWhere(req, { id: payload.contactId }) });
  }

  const phone = payload.to || payload.phone;
  if (!phone) return null;

  const [contact] = await Contact.findOrCreate({
    where: tenantWhere(req, { phone }),
    defaults: {
      workspaceId: req.workspaceId,
      phone,
      name: payload.name || phone,
      tags: ['mcp'],
      metadata: { source: 'mcp' }
    }
  });

  return contact;
}

router.get('/tools', (req, res) => {
  res.json({
    name: `${PRODUCT_NAME} WhatsApp MCP Proxy`,
    tools: [
      'search_contacts',
      'create_contact',
      'list_chats',
      'get_chat',
      'list_messages',
      'send_whatsapp_message',
      'send_file'
    ],
    backend: `${PRODUCT_SLUG}-api`
  });
});

router.post('/contacts', async (req, res, next) => {
  try {
    const { name, phone, email, tags, metadata } = req.body;
    if (!phone) return res.status(400).json({ error: 'Telefone é obrigatório' });

    const normalizedTags = Array.isArray(tags)
      ? tags
      : String(tags || 'mcp')
          .split(',')
          .map((tag) => tag.trim())
          .filter(Boolean);

    const [contact, created] = await Contact.findOrCreate({
      where: tenantWhere(req, { phone }),
      defaults: {
        workspaceId: req.workspaceId,
        name,
        email,
        tags: normalizedTags,
        metadata: {
          source: 'mcp',
          ...(metadata || {})
        }
      }
    });

    if (!created) {
      await contact.update({
        name: name ?? contact.name,
        email: email ?? contact.email,
        tags: tags === undefined ? contact.tags : normalizedTags,
        metadata: metadata ? { ...(contact.metadata || {}), ...metadata, source: 'mcp' } : contact.metadata
      });
    }

    res.status(created ? 201 : 200).json(contact);
  } catch (error) {
    next(error);
  }
});

router.get('/contacts/search', async (req, res, next) => {
  try {
    const query = String(req.query.q || req.query.query || '').trim();
    const where = query
      ? tenantWhere(req, {
          [Op.or]: [
            { name: { [likeOperator]: `%${query}%` } },
            { phone: { [likeOperator]: `%${query}%` } },
            { email: { [likeOperator]: `%${query}%` } }
          ]
        })
      : tenantWhere(req);

    const contacts = await Contact.findAll({
      where,
      order: [['updatedAt', 'DESC']],
      limit: Number(req.query.limit || 25)
    });

    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

router.get('/chats', async (req, res, next) => {
  try {
    const filter = req.query.filter || 'all';
    const base =
      filter === 'unassigned'
        ? { assignedAttendantId: null, status: 'open' }
        : filter === 'mine' && req.user.id !== 'service'
          ? { assignedAttendantId: req.user.id, status: 'open' }
          : {};

    const chats = await Chat.findAll({
      where: tenantWhere(req, base),
      include: chatInclude(Number(req.query.messageLimit || 10)),
      order: [['lastMessageAt', 'DESC']],
      limit: Number(req.query.limit || 50)
    });

    res.json(chats);
  } catch (error) {
    next(error);
  }
});

router.get('/chats/:id', async (req, res, next) => {
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

router.get('/chats/:id/messages', async (req, res, next) => {
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

router.post('/messages', async (req, res, next) => {
  try {
    const body = req.body.body || req.body.text || req.body.message;
    if (!body) return res.status(400).json({ error: 'body, text ou message é obrigatório' });

    const contact = await resolveContact(req, req.body);
    if (!contact) return res.status(404).json({ error: 'Contato ou conversa não encontrado' });

    const message = await sendAndRecordText(contact, body, {
      source: 'mcp',
      client: req.body.client || 'external-agent'
    });

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

router.post('/files', async (req, res, next) => {
  try {
    const mediaUrl = req.body.mediaUrl || req.body.url;
    if (!mediaUrl) return res.status(400).json({ error: 'mediaUrl ou url é obrigatório' });

    const contact = await resolveContact(req, req.body);
    if (!contact) return res.status(404).json({ error: 'Contato ou conversa não encontrado' });

    const message = await sendAndRecordMedia(
      contact,
      {
        mediaUrl,
        type: req.body.mediaType || req.body.type || 'document',
        caption: req.body.caption,
        filename: req.body.filename
      },
      {
        source: 'mcp',
        client: req.body.client || 'external-agent'
      }
    );

    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
