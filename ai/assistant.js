const axios = require('axios');
const { generateAIResponse: generateProviderResponse } = require('../openai');
const { PRODUCT_NAME } = require('../config/product');

const OPENAI_MODERATION_URL = 'https://api.openai.com/v1/moderations';

const intentRules = [
  { intent: 'billing', patterns: [/boleto/i, /pagamento/i, /cobranca/i, /invoice/i, /refund/i] },
  { intent: 'sales', patterns: [/preco/i, /plano/i, /comprar/i, /orcamento/i, /demo/i] },
  { intent: 'support', patterns: [/erro/i, /problema/i, /suporte/i, /bug/i, /nao funciona/i] },
  { intent: 'human_handoff', patterns: [/atendente/i, /humano/i, /pessoa/i, /falar com alguem/i] }
];

function redactPII(text = '') {
  return String(text)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted_email]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[redacted_cpf]')
    .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, '[redacted_cnpj]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[redacted_number]')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '[redacted_phone]');
}

function detectJailbreak(text = '') {
  const value = String(text).toLowerCase();
  return [
    'ignore previous instructions',
    'ignore all instructions',
    'system prompt',
    'developer message',
    'jailbreak',
    'dan mode',
    'reveal your instructions',
    'desconsidere as instrucoes',
    'ignore as instrucoes'
  ].some((phrase) => value.includes(phrase));
}

function classifyIntent(text = '') {
  const rule = intentRules.find((candidate) => candidate.patterns.some((pattern) => pattern.test(text)));
  return rule?.intent || 'general';
}

async function moderateUserInput(text) {
  if (detectJailbreak(text)) {
    return {
      allowed: false,
      reason: 'jailbreak_detected'
    };
  }

  if (process.env.OPENAI_MODERATION_ENABLED !== 'true' || !process.env.OPENAI_API_KEY) {
    return {
      allowed: true,
      reason: 'local_guardrails_only'
    };
  }

  try {
    const response = await axios.post(
      OPENAI_MODERATION_URL,
      {
        model: process.env.OPENAI_MODERATION_MODEL || 'omni-moderation-latest',
        input: text
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: Number(process.env.OPENAI_TIMEOUT_MS || 30000)
      }
    );

    const result = response.data?.results?.[0];
    return {
      allowed: !result?.flagged,
      reason: result?.flagged ? 'moderation_flagged' : 'moderation_passed',
      categories: result?.categories || {}
    };
  } catch (error) {
    console.warn(`[${PRODUCT_NAME}] Moderation failed; falling back to local guardrails.`, error.message);
    return {
      allowed: true,
      reason: 'moderation_unavailable'
    };
  }
}

function routeContextForIntent(intent, context) {
  const specializedAgents = context.specializedAgents || {};
  const agentId = specializedAgents[intent] || context.agentId;
  const intentInstruction = `Intent classified as ${intent}. Route to a specialized responder when available; otherwise answer within ${PRODUCT_NAME} support scope and escalate to a human for uncertain, legal, financial, medical or account-sensitive requests.`;

  return {
    ...context,
    agentId,
    businessContext: [context.businessContext, intentInstruction].filter(Boolean).join('\n')
  };
}

async function generateAssistantResponse(userMessage, context = {}) {
  const moderation = await moderateUserInput(userMessage);
  if (!moderation.allowed) {
    return context.guardrailFallback || 'Nao posso ajudar com essa solicitacao. Posso chamar um atendente para continuar por aqui.';
  }

  const sanitizedUserMessage = redactPII(userMessage);
  const intent = classifyIntent(userMessage);
  const routedContext = routeContextForIntent(intent, {
    ...context,
    guardrails: {
      piiRedaction: true,
      moderationReason: moderation.reason,
      intent
    }
  });

  const response = await generateProviderResponse(sanitizedUserMessage, routedContext);
  return redactPII(response);
}

module.exports = {
  classifyIntent,
  detectJailbreak,
  generateAIResponse: generateAssistantResponse,
  generateAssistantResponse,
  moderateUserInput,
  redactPII
};
