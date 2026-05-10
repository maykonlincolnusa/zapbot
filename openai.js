const axios = require('axios');
const { retrieveRelevantPassages } = require('./rag');
const { generateOpenRouterResponse } = require('./openrouter');
const { PRODUCT_NAME } = require('./config/product');

const OPENAI_CHAT_COMPLETIONS_URL = 'https://api.openai.com/v1/chat/completions';

async function resolveAgent(context) {
  if (context.agent) return context.agent;

  try {
    const { AiAgent } = require('./models');
    if (context.agentId) {
      const where = { id: context.agentId };
      if (context.workspaceId) where.workspaceId = context.workspaceId;
      const agent = await AiAgent.findOne({ where });
      if (agent?.active) return agent;
    }

    const where = { active: true, isDefault: true };
    if (context.workspaceId) where.workspaceId = context.workspaceId;
    return AiAgent.findOne({
      where,
      order: [['updatedAt', 'DESC']]
    });
  } catch (error) {
    console.warn(`[${PRODUCT_NAME}] Could not resolve AI agent.`, error.message);
    return null;
  }
}

async function buildMessages(userMessage, context = {}, agent = null) {
  const retrievedPassages = context.skipRag
    ? []
    : await retrieveRelevantPassages(userMessage, context.ragLimit || 3);

  const contextLines = [
    context.businessContext,
    context.contact ? `Contato: ${JSON.stringify(context.contact)}` : '',
    retrievedPassages.length ? `Passagens relevantes:\n${retrievedPassages.join('\n\n')}` : ''
  ].filter(Boolean);

  const messages = [
    {
      role: 'system',
      content:
        context.systemPrompt ||
        agent?.systemPrompt ||
        `Voce e o assistente de WhatsApp da plataforma ${PRODUCT_NAME}. Seja objetivo, cordial e focado em resolver a necessidade do contato.`
    }
  ];

  if (contextLines.length) {
    messages.push({
      role: 'system',
      content: `Contexto disponível:\n${contextLines.join('\n\n')}`
    });
  }

  messages.push({
    role: 'user',
    content: userMessage
  });

  return messages;
}

async function generateAIResponse(userMessage, context = {}) {
  const agent = await resolveAgent(context);
  const configuredProvider = context.provider || agent?.provider || process.env.DEFAULT_LLM_PROVIDER;
  const provider = configuredProvider || (process.env.OPENROUTER_API_KEY ? 'openrouter' : 'openai');
  const model =
    context.model ||
    agent?.model ||
    (provider === 'openrouter' ? process.env.OPENROUTER_DEFAULT_MODEL : process.env.OPENAI_MODEL) ||
    'openai/gpt-4o-mini';
  const temperature = Number(context.temperature ?? agent?.temperature ?? process.env.OPENAI_TEMPERATURE ?? 0.4);
  const fallbackText = context.fallbackText || agent?.fallbackText || 'Recebi sua mensagem. Um atendente vai continuar o atendimento por aqui.';
  const messages = await buildMessages(userMessage, context, agent);

  if (provider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) {
      console.warn(`[${PRODUCT_NAME}] OPENROUTER_API_KEY is not configured; returning fallback AI message.`);
      return fallbackText;
    }

    const result = await generateOpenRouterResponse({
      model,
      messages,
      temperature,
      maxTokens: context.maxTokens,
      sessionId: context.sessionId
    });
    return result.text;
  }

  if (!process.env.OPENAI_API_KEY) {
    console.warn(`[${PRODUCT_NAME}] OPENAI_API_KEY is not configured; returning fallback AI message.`);
    return fallbackText;
  }

  const response = await axios.post(
    OPENAI_CHAT_COMPLETIONS_URL,
    {
      model: model.startsWith('openai/') ? model.replace('openai/', '') : model,
      messages,
      temperature
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: Number(process.env.OPENAI_TIMEOUT_MS || 30000)
    }
  );

  return response.data?.choices?.[0]?.message?.content?.trim() || '';
}

module.exports = {
  generateAIResponse
};
