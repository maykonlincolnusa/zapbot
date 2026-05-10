export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const DEFAULT_TIMEOUT_MS = 15000;

export class ApiError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
    this.correlationId = options.correlationId;
    this.rawMessage = options.rawMessage;
  }
}

export function getToken() {
  return localStorage.getItem('zapbot_token') || '';
}

export function setToken(token) {
  if (token) {
    localStorage.setItem('zapbot_token', token);
  } else {
    localStorage.removeItem('zapbot_token');
  }
}

function friendlyErrorMessage(status, payload = {}) {
  if (status === 400) return 'Revise os campos e tente novamente.';
  if (status === 401) return 'Sua sessao expirou. Entre novamente.';
  if (status === 403) return 'Seu usuario nao tem permissao para esta acao.';
  if (status === 404) return 'Nao encontramos o recurso solicitado.';
  if (status === 409) return 'Ja existe um registro com estes dados.';
  if (status === 422) return 'Alguns dados enviados nao estao validos.';
  if (status === 429) return 'Muitas tentativas em pouco tempo. Aguarde e tente novamente.';
  if (status >= 500) return 'O servico esta indisponivel agora. Tente novamente em instantes.';

  return payload.message || payload.error || 'Nao foi possivel concluir a acao.';
}

async function readPayload(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}));
  }
  const text = await response.text().catch(() => '');
  return text ? { error: text } : {};
}

export async function api(path, options = {}) {
  const controller = new AbortController();
  const timeoutMs = options.timeoutMs || DEFAULT_TIMEOUT_MS;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const headers = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers || {})
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: options.signal || controller.signal
    });

    if (!response.ok) {
      const payload = await readPayload(response);
      throw new ApiError(friendlyErrorMessage(response.status, payload), {
        status: response.status,
        code: payload.code,
        details: payload.details,
        rawMessage: payload.error || payload.message,
        correlationId: response.headers.get('x-correlation-id')
      });
    }

    if (response.status === 204) return null;
    return readPayload(response);
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new ApiError('A requisicao demorou demais. Verifique sua conexao e tente novamente.', {
        code: 'TIMEOUT'
      });
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function eventSourceUrl(path) {
  const separator = path.includes('?') ? '&' : '?';
  return `${API_BASE_URL}${path}${separator}token=${encodeURIComponent(getToken())}`;
}
