const express = require('express');
const { Op } = require('sequelize');
const { Broadcast, BroadcastRecipient, Contact } = require('../models');
const { requireAuth, requireRole, tenantWhere } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function normalizeTags(tags) {
  if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
  if (typeof tags === 'string') return tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return [];
}

function randomBetween(min, max) {
  const low = Math.max(0, Number(min || 0));
  const high = Math.max(low, Number(max || low));
  return Math.floor(Math.random() * (high - low + 1)) + low;
}

function contactMatchesTags(contact, tags) {
  if (!tags.length) return true;
  const contactTags = contact.tags || [];
  return tags.every((tag) => contactTags.includes(tag));
}

async function buildRecipients(broadcast) {
  const targetTags = broadcast.targetTags || [];
  const contacts = await Contact.findAll({
    where: {
      workspaceId: broadcast.workspaceId,
      status: { [Op.ne]: 'blocked' }
    }
  });

  const selectedContacts = contacts.filter((contact) => contactMatchesTags(contact, targetTags));
  let offsetSeconds = 0;

  const recipients = [];
  for (const contact of selectedContacts) {
    const delaySeconds =
      broadcast.delayType === 'fixed'
        ? Number(broadcast.delayMinSeconds || 0)
        : randomBetween(broadcast.delayMinSeconds, broadcast.delayMaxSeconds);

    offsetSeconds += delaySeconds;
    recipients.push({
      workspaceId: broadcast.workspaceId,
      BroadcastId: broadcast.id,
      ContactId: contact.id,
      status: 'pending',
      scheduledAt: new Date(Date.now() + offsetSeconds * 1000)
    });
  }

  await BroadcastRecipient.bulkCreate(recipients);
  return recipients.length;
}

router.get('/', async (req, res, next) => {
  try {
    const broadcasts = await Broadcast.findAll({
      where: tenantWhere(req),
      include: [{ model: BroadcastRecipient, as: 'recipients' }],
      order: [['updatedAt', 'DESC']]
    });
    res.json(broadcasts);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('manager'), async (req, res, next) => {
  try {
    const { name, messageText, flowId, targetTags, delayType, delayMinSeconds, delayMaxSeconds, autoStart } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });
    if (!messageText && !flowId) return res.status(400).json({ error: 'Mensagem ou fluxo é obrigatório' });

    const broadcast = await Broadcast.create({
      workspaceId: req.workspaceId,
      name,
      messageText,
      flowId: flowId || null,
      targetTags: normalizeTags(targetTags),
      delayType: delayType || 'smart',
      delayMinSeconds: Number(delayMinSeconds || 1),
      delayMaxSeconds: Number(delayMaxSeconds || delayMinSeconds || 5),
      status: autoStart ? 'scheduled' : 'draft'
    });

    let recipientCount = 0;
    if (autoStart) {
      recipientCount = await buildRecipients(broadcast);
      await broadcast.update({ startedAt: new Date() });
    }

    res.status(201).json({ broadcast, recipientCount });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/start', requireRole('manager'), async (req, res, next) => {
  try {
    const broadcast = await Broadcast.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!broadcast) return res.status(404).json({ error: 'Transmissão não encontrada' });

    await BroadcastRecipient.destroy({ where: tenantWhere(req, { BroadcastId: broadcast.id, status: 'pending' }) });
    const recipientCount = await buildRecipients(broadcast);

    await broadcast.update({
      status: 'scheduled',
      startedAt: new Date(),
      completedAt: null
    });

    // Best practice: keep production broadcasts in smaller batches and stagger windows.
    // TODO: Add account-level rate limits, opt-out enforcement and template approval checks.
    res.json({ broadcast, recipientCount });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/recipients', async (req, res, next) => {
  try {
    const recipients = await BroadcastRecipient.findAll({
      where: tenantWhere(req, { BroadcastId: req.params.id }),
      include: [Contact],
      order: [['scheduledAt', 'ASC']]
    });
    res.json(recipients);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
