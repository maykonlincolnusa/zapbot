const express = require('express');
const { Flow, Contact, FlowSession } = require('../models');
const { requireAuth, requireRole, tenantWhere } = require('../middleware/auth');
const { startFlow } = require('../flowEngine');

const router = express.Router();
router.use(requireAuth);

function normalizeDefinition(definition) {
  if (typeof definition === 'string') return JSON.parse(definition);
  return definition || { start: 'start', steps: {} };
}

router.get('/', async (req, res, next) => {
  try {
    const flows = await Flow.findAll({ where: tenantWhere(req), order: [['updatedAt', 'DESC']] });
    res.json(flows);
  } catch (error) {
    next(error);
  }
});

router.post('/', requireRole('manager'), async (req, res, next) => {
  try {
    const { name, trigger, definition, active } = req.body;
    if (!name || !definition) {
      return res.status(400).json({ error: 'Nome e definição são obrigatórios' });
    }

    const flow = await Flow.create({
      workspaceId: req.workspaceId,
      name,
      trigger,
      definition: normalizeDefinition(definition),
      active: active !== false
    });

    res.status(201).json(flow);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const flow = await Flow.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!flow) return res.status(404).json({ error: 'Fluxo não encontrado' });
    res.json(flow);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const flow = await Flow.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!flow) return res.status(404).json({ error: 'Fluxo não encontrado' });

    await flow.update({
      name: req.body.name ?? flow.name,
      trigger: req.body.trigger ?? flow.trigger,
      definition: req.body.definition === undefined ? flow.definition : normalizeDefinition(req.body.definition),
      active: req.body.active ?? flow.active
    });

    res.json(flow);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const deleted = await Flow.destroy({ where: tenantWhere(req, { id: req.params.id }) });
    if (!deleted) return res.status(404).json({ error: 'Fluxo não encontrado' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/:id/start', requireRole('attendant'), async (req, res, next) => {
  try {
    const flow = await Flow.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!flow) return res.status(404).json({ error: 'Fluxo não encontrado' });

    const contact = await Contact.findOne({ where: tenantWhere(req, { id: req.body.contactId }) });
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });

    const result = await startFlow({
      models: { FlowSession },
      workspaceId: req.workspaceId,
      contactId: contact.id,
      flow
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
