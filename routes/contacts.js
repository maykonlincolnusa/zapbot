const express = require('express');
const { Contact, Chat, Message, Attendant } = require('../models');
const { requireAuth, requireRole, tenantWhere } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');

const router = express.Router();
router.use(requireAuth);

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}

router.get('/', async (req, res, next) => {
  try {
    const contacts = await Contact.findAll({ where: tenantWhere(req), order: [['updatedAt', 'DESC']] });
    res.json(contacts);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('attendant'), validateBody(schemas.contactCreate), async (req, res, next) => {
  try {
    const { name, phone, email, tags, metadata } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Telefone é obrigatório' });
    }

    const [contact, created] = await Contact.findOrCreate({
      where: tenantWhere(req, { phone }),
      defaults: {
        workspaceId: req.workspaceId,
        name,
        email,
        tags: normalizeTags(tags),
        metadata: metadata || {}
      }
    });

    if (!created) {
      await contact.update({
        name: name ?? contact.name,
        email: email ?? contact.email,
        tags: tags === undefined ? contact.tags : normalizeTags(tags),
        metadata: metadata ?? contact.metadata
      });
    }

    res.status(created ? 201 : 200).json(contact);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({
      where: tenantWhere(req, { id: req.params.id }),
      include: [
        {
          model: Chat,
          include: [
            { model: Attendant, as: 'assignedAttendant', attributes: ['id', 'name', 'email', 'role'] },
            { model: Message, limit: 25, order: [['createdAt', 'DESC']] }
          ]
        }
      ]
    });

    if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });
    res.json(contact);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('attendant'), validateBody(schemas.contactUpdate), async (req, res, next) => {
  try {
    const contact = await Contact.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });

    await contact.update({
      name: req.body.name ?? contact.name,
      phone: req.body.phone ?? contact.phone,
      email: req.body.email ?? contact.email,
      tags: req.body.tags === undefined ? contact.tags : normalizeTags(req.body.tags),
      status: req.body.status ?? contact.status,
      metadata: req.body.metadata ?? contact.metadata
    });

    res.json(contact);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const deleted = await Contact.destroy({ where: tenantWhere(req, { id: req.params.id }) });
    if (!deleted) return res.status(404).json({ error: 'Contato não encontrado' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
