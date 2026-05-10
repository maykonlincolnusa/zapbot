const axios = require('axios');
const { PRODUCT_NAME } = require('./config/product');

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

const fallbackModels = [
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o mini',
    context_length: 128000,
    pricing: { prompt: '0', completion: '0' },
    architecture: { modality: 'text->text' }
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    context_length: 128000,
    pricing: { prompt: '0', completion: '0' },
    architecture: { modality: 'text->text' }
  },
  {
    id: 'anthropic/claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    context_length: 200000,
    pricing: { prompt: '0', completion: '0' },
    architecture: { modality: 'text->text' }
  },
  {
    id: 'google/gemini-flash-1.5',
    name: 'Gemini Flash 1.5',
    context_length: 1000000,
    pricing: { prompt: '0', completion: '0' },
    architecture: { modality: 'text->text' }
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    name: 'Llama 3.1 70B Instruct',
    context_length: 131072,
    pricing: { prompt: '0', completion: '0' },
    architecture: { modality: 'text->text' }
  }
];

function openRouterHeaders() {
  const headers = {
    'Content-Type': 'application/json',
    'HTTP-Referer': process.env.PUBLIC_APP_URL || 'http://localhost:5173',
    'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME || PRODUCT_NAME
  };

  if (process.env.OPENROUTER_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENROUTER_API_KEY}`;
  }

  return headers;
}

function normalizeModel(model) {
  return {
    id: model.id,
    name: model.name || model.id,
    contextLength: model.context_length,
    pricing: model.pricing || {},
    architecture: model.architecture || {},
    supportedParameters: model.supported_parameters || []
  };
}

async function listOpenRouterModels() {
  if (!process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_REQUIRE_KEY_FOR_MODELS === 'true') {
    return {
      configured: false,
      models: fallbackModels.map(normalizeModel),
      source: 'fallback'
    };
  }

  try {
    const response = await axios.get(`${OPENROUTER_BASE_URL}/models`, {
      headers: openRouterHeaders(),
      timeout: Number(process.env.OPENROUTER_TIMEOUT_MS || 30000)
    });

    return {
      configured: Boolean(process.env.OPENROUTER_API_KEY),
      models: (response.data?.data || []).map(normalizeModel),
      source: 'openrouter'
    };
  } catch (error) {
    console.warn(`[${PRODUCT_NAME}] Failed to load OpenRouter models; using fallback list.`, error.message);
    return {
      configured: Boolean(process.env.OPENROUTER_API_KEY),
      models: fallbackModels.map(normalizeModel),
      source: 'fallback',
      error: error.message
    };
  }
}

async function generateOpenRouterResponse({ model, messages, temperature, maxTokens, sessionId }) {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('Missing OPENROUTER_API_KEY');
  }

  const response = await axios.post(
    `${OPENROUTER_BASE_URL}/chat/completions`,
    {
      model: model || process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-4o-mini',
      messages,
      temperature,
      max_tokens: maxTokens,
      session_id: sessionId
    },
    {
      headers: openRouterHeaders(),
      timeout: Number(process.env.OPENROUTER_TIMEOUT_MS || 30000)
    }
  );

  return {
    text: response.data?.choices?.[0]?.message?.content?.trim() || '',
    raw: response.data
  };
}

module.exports = {
  listOpenRouterModels,
  generateOpenRouterResponse
};
