const axios = require('axios');
require('dotenv').config();

const PROVIDERS = {
  gpt: {
    id: 'gpt',
    label: 'GPT',
    envKey: 'OPENAI_API_KEY',
    baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    defaultModel: process.env.OPENAI_MODEL || 'gpt-4o-mini'
  },
  claude: {
    id: 'claude',
    label: 'Claude',
    envKey: 'ANTHROPIC_API_KEY',
    baseUrl: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
    defaultModel: process.env.CLAUDE_MODEL || 'claude-3-5-haiku-latest'
  },
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    envKey: 'GEMINI_API_KEY',
    baseUrl: process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  },
  grok: {
    id: 'grok',
    label: 'Grok',
    envKey: 'XAI_API_KEY',
    baseUrl: process.env.XAI_BASE_URL || 'https://api.x.ai/v1',
    defaultModel: process.env.GROK_MODEL || 'grok-4'
  }
};

function configuredProviders() {
  return Object.values(PROVIDERS).map((provider) => ({
    id: provider.id,
    label: provider.label,
    defaultModel: provider.defaultModel,
    configured: Boolean(process.env[provider.envKey]) && !String(process.env[provider.envKey]).startsWith('replace-'),
    envKey: provider.envKey
  }));
}

function normalizeMessages({ systemPrompt, history = [], userMessage }) {
  return [
    { role: 'system', content: systemPrompt },
    ...history.slice(-12).map((item) => ({
      role: item.direction === 'inbound' ? 'user' : 'assistant',
      content: item.body
    })),
    { role: 'user', content: userMessage }
  ];
}

function mockReply({ provider, model, userMessage, conversionGoal }) {
  return {
    mode: 'mock',
    provider,
    model,
    reply:
      `Modo simulado (${provider}/${model}). Recebi: "${userMessage}". ` +
      `Objetivo comercial: ${conversionGoal}. Configure a chave do provedor para resposta real.`
  };
}

async function callOpenAiCompatible({ provider, apiKey, baseUrl, model, messages, temperature }) {
  const response = await axios.post(
    `${baseUrl}/chat/completions`,
    {
      model,
      messages,
      temperature
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: Number(process.env.AI_PROVIDER_TIMEOUT_MS || 30000)
    }
  );

  return {
    mode: 'live',
    provider,
    model,
    reply: response.data.choices?.[0]?.message?.content?.trim() || '',
    usage: response.data.usage || null
  };
}

async function callClaude({ apiKey, baseUrl, model, messages, temperature }) {
  const system = messages.find((message) => message.role === 'system')?.content || '';
  const conversation = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role, content: message.content }));

  const response = await axios.post(
    `${baseUrl}/v1/messages`,
    {
      model,
      system,
      max_tokens: Number(process.env.CLAUDE_MAX_TOKENS || 700),
      temperature,
      messages: conversation
    },
    {
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
        'Content-Type': 'application/json'
      },
      timeout: Number(process.env.AI_PROVIDER_TIMEOUT_MS || 30000)
    }
  );

  return {
    mode: 'live',
    provider: 'claude',
    model,
    reply: response.data.content?.find((item) => item.type === 'text')?.text?.trim() || '',
    usage: response.data.usage || null
  };
}

async function callGemini({ apiKey, baseUrl, model, messages, temperature }) {
  const system = messages.find((message) => message.role === 'system')?.content || '';
  const contents = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }]
    }));

  const response = await axios.post(
    `${baseUrl}/models/${model}:generateContent`,
    {
      system_instruction: {
        parts: [{ text: system }]
      },
      contents,
      generationConfig: {
        temperature
      }
    },
    {
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      timeout: Number(process.env.AI_PROVIDER_TIMEOUT_MS || 30000)
    }
  );

  return {
    mode: 'live',
    provider: 'gemini',
    model,
    reply: response.data.candidates?.[0]?.content?.parts?.map((part) => part.text).join('').trim() || '',
    usage: response.data.usageMetadata || null
  };
}

async function generateWithProvider({ providerId, model, systemPrompt, userMessage, history, temperature, conversionGoal }) {
  const provider = PROVIDERS[providerId] || PROVIDERS.gpt;
  const selectedModel = model || provider.defaultModel;
  const apiKey = process.env[provider.envKey];

  if (!apiKey || String(apiKey).startsWith('replace-')) {
    return mockReply({ provider: provider.id, model: selectedModel, userMessage, conversionGoal });
  }

  const messages = normalizeMessages({ systemPrompt, history, userMessage });

  if (provider.id === 'claude') {
    return callClaude({ apiKey, baseUrl: provider.baseUrl, model: selectedModel, messages, temperature });
  }

  if (provider.id === 'gemini') {
    return callGemini({ apiKey, baseUrl: provider.baseUrl, model: selectedModel, messages, temperature });
  }

  return callOpenAiCompatible({
    provider: provider.id,
    apiKey,
    baseUrl: provider.baseUrl,
    model: selectedModel,
    messages,
    temperature
  });
}

module.exports = {
  PROVIDERS,
  configuredProviders,
  generateWithProvider
};
