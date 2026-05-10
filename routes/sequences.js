const express = require('express');
const { Sequence, SequenceStep, SequenceEnrollment, Contact } = require('../models');
const { requireAuth, requireRole, tenantWhere } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function toDelayMinutes(step) {
  if (Number.isFinite(Number(step.delayMinutes))) return Number(step.delayMinutes);

  const value = Number(step.delayValue || 0);
  const unit = step.delayUnit || 'minutes';

  if (unit === 'days') return value * 24 * 60;
  if (unit === 'hours') return value * 60;
  return value;
}

async function replaceSteps(req, sequence, steps = []) {
  await SequenceStep.destroy({ where: { SequenceId: sequence.id } });

  const normalized = steps.map((step, index) => ({
    workspaceId: req.workspaceId,
    SequenceId: sequence.id,
    stepOrder: step.stepOrder || index + 1,
    delayMinutes: toDelayMinutes(step),
    messageText: step.messageText || step.message || '',
    flowId: step.flowId || null
  }));

  if (normalized.length) {
    await SequenceStep.bulkCreate(normalized);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const sequences = await Sequence.findAll({
      where: tenantWhere(req),
      include: [{ model: SequenceStep, as: 'steps' }],
      order: [['updatedAt', 'DESC']]
    });
    res.json(sequences);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('manager'), async (req, res, next) => {
  try {
    const { name, description, active, steps } = req.body;
    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    const sequence = await Sequence.create({
      workspaceId: req.workspaceId,
      name,
      description,
      active: active !== false
    });

    await replaceSteps(req, sequence, steps || []);

    const saved = await Sequence.findByPk(sequence.id, {
      include: [{ model: SequenceStep, as: 'steps' }]
    });

    res.status(201).json(saved);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const sequence = await Sequence.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!sequence) return res.status(404).json({ error: 'Sequência não encontrada' });

    await sequence.update({
      name: req.body.name ?? sequence.name,
      description: req.body.description ?? sequence.description,
      active: req.body.active ?? sequence.active
    });

    if (Array.isArray(req.body.steps)) {
      await replaceSteps(req, sequence, req.body.steps);
    }

    const saved = await Sequence.findByPk(sequence.id, {
      include: [{ model: SequenceStep, as: 'steps' }]
    });

    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/enroll', requireRole('manager'), async (req, res, next) => {
  try {
    const sequence = await Sequence.findOne({
      where: tenantWhere(req, { id: req.params.id }),
      include: [{ model: SequenceStep, as: 'steps' }]
    });
    if (!sequence) return res.status(404).json({ error: 'Sequência não encontrada' });

    const contactIds = Array.isArray(req.body.contactIds) ? req.body.contactIds : [req.body.contactId];
    const firstStep = [...sequence.steps].sort((a, b) => a.stepOrder - b.stepOrder)[0];
    if (!firstStep) return res.status(400).json({ error: 'Sequence has no steps' });

    const contacts = await Contact.findAll({ where: tenantWhere(req, { id: contactIds.filter(Boolean) }) });
    const nextRunAt = new Date(Date.now() + firstStep.delayMinutes * 60 * 1000);

    const enrollments = [];
    for (const contact of contacts) {
      const [enrollment] = await SequenceEnrollment.findOrCreate({
        where: tenantWhere(req, { SequenceId: sequence.id, ContactId: contact.id }),
        defaults: {
          workspaceId: req.workspaceId,
          currentStepOrder: 0,
          status: 'active',
          nextRunAt
        }
      });
      await enrollment.update({ status: 'active', nextRunAt });
      enrollments.push(enrollment);
    }

    res.status(201).json(enrollments);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/enrollments', async (req, res, next) => {
  try {
    const enrollments = await SequenceEnrollment.findAll({
      where: tenantWhere(req, { SequenceId: req.params.id }),
      include: [Contact],
      order: [['updatedAt', 'DESC']]
    });
    res.json(enrollments);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
