const { createServiceApp, startService } = require('../_shared/app');
const { requireAuthOrService } = require('../_shared/auth');
const { requestOrgId } = require('../_shared/tenant');
const { initDb, AiAgent, AiRoutingSettings } = require('./db');
const { PROVIDERS, configuredProviders, generateWithProvider } = require('./providers');
require('dotenv').config();

const app = createServiceApp('ai-service');
const port = process.env.AI_PORT || 3005;

app.use(requireAuthOrService);

async function defaultAgent(req) {
  const [agent] = await AiAgent.findOrCreate({
    where: { orgId: requestOrgId(req), name: 'Atendimento inteligente' },
    defaults: {
      orgId: requestOrgId(req),
      name: 'Atendimento inteligente',
      systemPrompt:
        'Voce e um assistente de WhatsApp para vendas e suporte. Responda com clareza, em poucas linhas, e peca dados do cliente quando necessario.',
      temperature: 0.4,
      active: true
    }
  });
  return agent;
}

async function routingSettings(req) {
  const [settings] = await AiRoutingSettings.findOrCreate({
    where: { orgId: requestOrgId(req) },
    defaults: {
      orgId: requestOrgId(req),
      defaultProvider: process.env.DEFAULT_AI_PROVIDER || 'gpt',
      defaultModel: process.env.DEFAULT_AI_MODEL || PROVIDERS.gpt.defaultModel,
      fallbackProvider: process.env.FALLBACK_AI_PROVIDER || 'claude',
      fallbackModel: process.env.FALLBACK_AI_MODEL || PROVIDERS.claude.defaultModel
    }
  });
  return settings;
}

function buildSalesSystemPrompt({ agent, settings, context = {} }) {
  return [
    agent.systemPrompt,
    '',
    'Modo de vendas da plataforma:',
    `- Estilo: ${settings.salesMode}.`,
    `- Objetivo: ${settings.conversionGoal}.`,
    '- Responda em texto curto para WhatsApp.',
    '- Faça uma pergunta objetiva quando precisar qualificar o lead.',
    '- Se o lead demonstrar intenção de compra, conduza para proposta, agendamento ou pagamento.',
    '- Nao invente preço, prazo ou disponibilidade que nao estejam no contexto.',
    context.product ? `- Produto/servico: ${context.product}.` : '',
    context.offer ? `- Oferta atual: ${context.offer}.` : '',
    context.nextStep ? `- Proximo passo desejado: ${context.nextStep}.` : ''
  ]
    .filter(Boolean)
    .join('\n');
}

async function generateSalesReply(req, { forceSalesPrompt = false } = {}) {
  const agent = req.body.agentId
    ? await AiAgent.findOne({ where: { id: req.body.agentId, orgId: requestOrgId(req), active: true } })
    : await defaultAgent(req);

  if (!agent) {
    const error = new Error('AI agent not found');
    error.status = 404;
    throw error;
  }

  const settings = await routingSettings(req);
  const provider = req.body.provider || settings.defaultProvider;
  const model = req.body.model || settings.defaultModel || PROVIDERS[provider]?.defaultModel;
  const userMessage = String(req.body.message || '');
  const history = req.body.history || [];
  const context = req.body.context || {};
  const systemPrompt =
    forceSalesPrompt || req.body.conversionGoal || Object.keys(context).length
      ? buildSalesSystemPrompt({ agent, settings, context })
      : agent.systemPrompt;

  return generateWithProvider({
    providerId: provider,
    model,
    systemPrompt,
    userMessage,
    history,
    temperature: req.body.temperature ?? agent.temperature,
    conversionGoal: req.body.conversionGoal || settings.conversionGoal
  });
}

app.get('/providers', async (req, res, next) => {
  try {
    const settings = await routingSettings(req);
    res.json({
      settings,
      providers: configuredProviders()
    });
  } catch (error) {
    next(error);
  }
});

app.get('/settings', async (req, res, next) => {
  try {
    res.json(await routingSettings(req));
  } catch (error) {
    next(error);
  }
});

app.put('/settings', async (req, res, next) => {
  try {
    const settings = await routingSettings(req);
    const nextProvider = req.body.defaultProvider ?? settings.defaultProvider;
    const fallbackProvider = req.body.fallbackProvider ?? settings.fallbackProvider;

    if (!PROVIDERS[nextProvider]) return res.status(400).json({ error: 'Invalid defaultProvider' });
    if (!PROVIDERS[fallbackProvider]) return res.status(400).json({ error: 'Invalid fallbackProvider' });

    await settings.update({
      defaultProvider: nextProvider,
      defaultModel: req.body.defaultModel ?? settings.defaultModel,
      fallbackProvider,
      fallbackModel: req.body.fallbackModel ?? settings.fallbackModel,
      salesMode: req.body.salesMode ?? settings.salesMode,
      conversionGoal: req.body.conversionGoal ?? settings.conversionGoal
    });

    res.json(settings);
  } catch (error) {
    next(error);
  }
});

app.get('/agents', async (req, res, next) => {
  try {
    res.json(await AiAgent.findAll({ where: { orgId: requestOrgId(req) }, order: [['updatedAt', 'DESC']] }));
  } catch (error) {
    next(error);
  }
});

app.post('/agents', async (req, res, next) => {
  try {
    const agent = await AiAgent.create({
      orgId: requestOrgId(req),
      name: req.body.name,
      systemPrompt: req.body.systemPrompt,
      temperature: req.body.temperature ?? 0.4,
      active: req.body.active ?? true
    });
    res.status(201).json(agent);
  } catch (error) {
    next(error);
  }
});

app.put('/agents/:id', async (req, res, next) => {
  try {
    const agent = await AiAgent.findOne({ where: { id: req.params.id, orgId: requestOrgId(req) } });
    if (!agent) return res.sendStatus(404);

    await agent.update({
      name: req.body.name ?? agent.name,
      systemPrompt: req.body.systemPrompt ?? agent.systemPrompt,
      temperature: req.body.temperature ?? agent.temperature,
      active: req.body.active ?? agent.active
    });
    res.json(agent);
  } catch (error) {
    next(error);
  }
});

app.post('/chat/reply', async (req, res, next) => {
  try {
    res.json(await generateSalesReply(req));
  } catch (error) {
    next(error);
  }
});

app.post('/sales/reply', async (req, res, next) => {
  try {
    res.json(await generateSalesReply(req, { forceSalesPrompt: true }));
  } catch (error) {
    next(error);
  }
});

function scoreLead({ contact = {}, deal = {}, history = [] }) {
  let score = 20;
  const reasons = [];

  if (contact.email) {
    score += 10;
    reasons.push('Contato tem email cadastrado');
  }
  if (contact.phone) {
    score += 10;
    reasons.push('Contato tem WhatsApp cadastrado');
  }
  if ((contact.Tags || contact.tags || []).some((tag) => String(tag.name || tag).toLowerCase().includes('vip'))) {
    score += 20;
    reasons.push('Contato marcado como VIP');
  }
  if (deal.valueCents > 0) {
    score += Math.min(25, Math.round(deal.valueCents / 10000));
    reasons.push('Existe oportunidade comercial com valor estimado');
  }
  if (deal.stage && !['perdido', 'lost'].includes(String(deal.stage).toLowerCase())) {
    score += 10;
    reasons.push('Oportunidade ainda ativa no funil');
  }
  if (history.length >= 2) {
    score += 10;
    reasons.push('Cliente ja interagiu na conversa');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    score,
    temperature: score >= 75 ? 'hot' : score >= 45 ? 'warm' : 'cold',
    reasons
  };
}

app.post('/insights/lead-score', async (req, res, next) => {
  try {
    const contact = req.body.contact || {};
    const deal = req.body.deal || {};
    const history = req.body.history || [];
    const score = scoreLead({ contact, deal, history });

    const suggestedActions = [];
    if (score.temperature === 'hot') {
      suggestedActions.push('Criar tarefa de contato humano em ate 15 minutos');
      suggestedActions.push('Enviar fluxo de qualificacao comercial');
    } else if (score.temperature === 'warm') {
      suggestedActions.push('Adicionar etiqueta de nutricao');
      suggestedActions.push('Agendar follow-up para o proximo dia util');
    } else {
      suggestedActions.push('Enviar conteudo educativo antes de abordar venda');
    }

    res.json({
      mode: 'rules',
      contactId: contact.id || null,
      dealId: deal.id || null,
      ...score,
      suggestedActions,
      summary: `Lead ${score.temperature} com score ${score.score}/100.`
    });
  } catch (error) {
    next(error);
  }
});

initDb()
  .then(() => startService(app, 'ai-service', port))
  .catch((error) => {
    console.error('ai-service failed to start', error);
    process.exit(1);
  });
