const express = require('express');
const { AiAgent } = require('../models');
const { requireAuth, requireRole, tenantWhere } = require('../middleware/auth');
const { listOpenRouterModels } = require('../openrouter');
const { generateAIResponse } = require('../ai/assistant');
const { answerPlatformQuestion } = require('../ai/platformAssistant');

const router = express.Router();
router.use(requireAuth);

function publicAgent(agent) {
  return {
    id: agent.id,
    name: agent.name,
    provider: agent.provider,
    model: agent.model,
    systemPrompt: agent.systemPrompt,
    temperature: agent.temperature,
    fallbackText: agent.fallbackText,
    isDefault: agent.isDefault,
    active: agent.active,
    metadata: agent.metadata,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt
  };
}

async function applyDefault(agent) {
  if (!agent.isDefault) return;
  await AiAgent.update({ isDefault: false }, { where: { workspaceId: agent.workspaceId } });
  await agent.update({ isDefault: true, active: true });
}

router.get('/providers', (req, res) => {
  res.json([
    {
      id: 'openrouter',
      name: 'OpenRouter',
      configured: Boolean(process.env.OPENROUTER_API_KEY),
      defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4o-mini',
      description: 'Gateway com centenas de modelos de vários provedores usando uma API compatível com Chat Completions.'
    },
    {
      id: 'openai',
      name: 'OpenAI direto',
      configured: Boolean(process.env.OPENAI_API_KEY),
      defaultModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      description: 'Integração direta com a API da OpenAI.'
    }
  ]);
});

router.get('/models', requireRole('manager'), async (req, res, next) => {
  try {
    const models = await listOpenRouterModels();
    res.json(models);
  } catch (error) {
    next(error);
  }
});

router.post('/assistant', async (req, res, next) => {
  try {
    const message = req.body.message || 'Como uso a plataforma?';
    const result = await answerPlatformQuestion(message, {
      workspaceId: req.workspaceId,
      role: req.user.role,
      activeTab: req.body.activeTab,
      workspaceName: req.workspace?.name
    });

    res.json({
      message,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

router.get('/agents', requireRole('manager'), async (req, res, next) => {
  try {
    const agents = await AiAgent.findAll({
      where: tenantWhere(req),
      order: [['isDefault', 'DESC'], ['updatedAt', 'DESC']]
    });
    res.json(agents.map(publicAgent));
  } catch (error) {
    next(error);
  }
});

router.post('/agents', requireRole('manager'), async (req, res, next) => {
  try {
    const { name, provider, model, systemPrompt, temperature, fallbackText, isDefault, active, metadata } = req.body;

    if (!name || !model) {
      return res.status(400).json({ error: 'name e model são obrigatórios' });
    }

    const agent = await AiAgent.create({
      workspaceId: req.workspaceId,
      name,
      provider: provider || 'openrouter',
      model,
      systemPrompt: systemPrompt || undefined,
      temperature: Number(temperature ?? 0.4),
      fallbackText: fallbackText || undefined,
      isDefault: Boolean(isDefault),
      active: active !== false,
      metadata: metadata || {}
    });

    await applyDefault(agent);
    res.status(201).json(publicAgent(agent));
  } catch (error) {
    next(error);
  }
});

router.put('/agents/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const agent = await AiAgent.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    await agent.update({
      name: req.body.name ?? agent.name,
      provider: req.body.provider ?? agent.provider,
      model: req.body.model ?? agent.model,
      systemPrompt: req.body.systemPrompt ?? agent.systemPrompt,
      temperature: req.body.temperature === undefined ? agent.temperature : Number(req.body.temperature),
      fallbackText: req.body.fallbackText ?? agent.fallbackText,
      isDefault: req.body.isDefault ?? agent.isDefault,
      active: req.body.active ?? agent.active,
      metadata: req.body.metadata ?? agent.metadata
    });

    await applyDefault(agent);
    res.json(publicAgent(agent));
  } catch (error) {
    next(error);
  }
});

router.post('/agents/:id/default', requireRole('manager'), async (req, res, next) => {
  try {
    const agent = await AiAgent.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    await AiAgent.update({ isDefault: false }, { where: tenantWhere(req) });
    await agent.update({ isDefault: true, active: true });
    res.json(publicAgent(agent));
  } catch (error) {
    next(error);
  }
});

router.delete('/agents/:id', requireRole('manager'), async (req, res, next) => {
  try {
    const deleted = await AiAgent.destroy({ where: tenantWhere(req, { id: req.params.id }) });
    if (!deleted) return res.status(404).json({ error: 'Agente não encontrado' });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

router.post('/agents/:id/test', requireRole('manager'), async (req, res, next) => {
  try {
    const agent = await AiAgent.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!agent) return res.status(404).json({ error: 'Agente não encontrado' });

    const message = req.body.message || 'Olá, quero saber mais sobre o atendimento.';
    const response = await generateAIResponse(message, {
      agent,
      workspaceId: req.workspaceId,
      skipRag: true,
      fallbackText: agent.fallbackText
    });

    res.json({
      agent: publicAgent(agent),
      message,
      response
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
