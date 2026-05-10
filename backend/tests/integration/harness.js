const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '../..');
const tmpRoot = process.env.ZAPBOT_TEST_TMP || 'C:\\tmp\\zapbot-tests';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth(url, timeoutMs = 30000) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await delay(250);
  }

  throw lastError || new Error(`Timed out waiting for ${url}`);
}

function sqliteUrl(runId, service) {
  const testDir = path.join(tmpRoot, runId);
  fs.mkdirSync(testDir, { recursive: true });
  return `sqlite:${path.join(testDir, `${service}.sqlite`)}`;
}

function cleanTestData(runId) {
  fs.rmSync(path.join(tmpRoot, runId), { recursive: true, force: true });
}

function createStack() {
  const runId = `${Date.now()}-${process.pid}`;
  const basePort = 4300 + Math.floor(Math.random() * 800);
  const ports = {
    gateway: basePort,
    auth: basePort + 1,
    crm: basePort + 2,
    automation: basePort + 3,
    messaging: basePort + 4,
    ai: basePort + 5,
    billing: basePort + 6,
    team: basePort + 7,
    livechat: basePort + 8,
    broadcasts: basePort + 9,
    integrations: basePort + 10,
    publicApi: basePort + 11
  };

  cleanTestData(runId);

  const env = {
    ...process.env,
    NODE_ENV: 'test',
    LOG_FORMAT: 'tiny',
    GATEWAY_PORT: String(ports.gateway),
    PORT: String(ports.gateway),
    AUTH_PORT: String(ports.auth),
    CRM_PORT: String(ports.crm),
    AUTOMATION_PORT: String(ports.automation),
    MESSAGING_PORT: String(ports.messaging),
    AI_PORT: String(ports.ai),
    BILLING_PORT: String(ports.billing),
    TEAM_PORT: String(ports.team),
    LIVECHAT_PORT: String(ports.livechat),
    BROADCASTS_PORT: String(ports.broadcasts),
    INTEGRATIONS_PORT: String(ports.integrations),
    PUBLIC_API_PORT: String(ports.publicApi),
    AUTH_SERVICE_URL: `http://127.0.0.1:${ports.auth}`,
    CRM_SERVICE_URL: `http://127.0.0.1:${ports.crm}`,
    AUTOMATION_SERVICE_URL: `http://127.0.0.1:${ports.automation}`,
    MESSAGING_SERVICE_URL: `http://127.0.0.1:${ports.messaging}`,
    AI_SERVICE_URL: `http://127.0.0.1:${ports.ai}`,
    BILLING_SERVICE_URL: `http://127.0.0.1:${ports.billing}`,
    TEAM_SERVICE_URL: `http://127.0.0.1:${ports.team}`,
    LIVECHAT_SERVICE_URL: `http://127.0.0.1:${ports.livechat}`,
    BROADCASTS_SERVICE_URL: `http://127.0.0.1:${ports.broadcasts}`,
    INTEGRATIONS_SERVICE_URL: `http://127.0.0.1:${ports.integrations}`,
    PUBLIC_API_SERVICE_URL: `http://127.0.0.1:${ports.publicApi}`,
    AUTH_DATABASE_URL: sqliteUrl(runId, 'auth'),
    CRM_DATABASE_URL: sqliteUrl(runId, 'crm'),
    AUTOMATION_DATABASE_URL: sqliteUrl(runId, 'automation'),
    MESSAGING_DATABASE_URL: sqliteUrl(runId, 'messaging'),
    AI_DATABASE_URL: sqliteUrl(runId, 'ai'),
    BILLING_DATABASE_URL: sqliteUrl(runId, 'billing'),
    TEAM_DATABASE_URL: sqliteUrl(runId, 'team'),
    LIVECHAT_DATABASE_URL: sqliteUrl(runId, 'livechat'),
    BROADCASTS_DATABASE_URL: sqliteUrl(runId, 'broadcasts'),
    INTEGRATIONS_DATABASE_URL: sqliteUrl(runId, 'integrations'),
    JWT_SECRET: `test-jwt-${runId}`,
    SERVICE_TOKEN: `test-service-${runId}`,
    DEFAULT_ORG_ID: '1',
    WHATSAPP_VERIFY_TOKEN: 'verify-test-token',
    WHATSAPP_DRY_RUN: 'true',
    WHATSAPP_API_TOKEN: 'replace-with-test-token',
    WHATSAPP_PHONE_NUMBER_ID: 'replace-with-test-phone-id',
    OPENAI_API_KEY: 'replace-with-test-openai-key',
    OPENAI_MODEL: 'gpt-4o-mini',
    ANTHROPIC_API_KEY: 'replace-with-test-anthropic-key',
    CLAUDE_MODEL: 'claude-3-5-haiku-latest',
    GEMINI_API_KEY: 'replace-with-test-gemini-key',
    GEMINI_MODEL: 'gemini-2.5-flash',
    XAI_API_KEY: 'replace-with-test-xai-key',
    GROK_MODEL: 'grok-4',
    DEFAULT_AI_PROVIDER: 'gpt',
    DEFAULT_AI_MODEL: 'gpt-4o-mini',
    FALLBACK_AI_PROVIDER: 'claude',
    FALLBACK_AI_MODEL: 'claude-3-5-haiku-latest',
    PAYMENT_PROVIDER: 'mock',
    API_INTEGRATION_KEY: `api-key-${runId}`,
    INTEGRATIONS_DRY_RUN: 'true',
    PUBLIC_APP_URL: 'http://localhost:5173'
  };

  const services = [
    'auth',
    'crm',
    'automation',
    'ai',
    'billing',
    'team',
    'livechat',
    'broadcasts',
    'integrations',
    'messaging',
    'public-api',
    'gateway'
  ];
  const children = [];
  const logs = new Map();

  function startService(service) {
    const child = spawn(process.execPath, [path.join(root, 'services', service, 'index.js')], {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    logs.set(service, '');
    child.stdout.on('data', (chunk) => logs.set(service, `${logs.get(service)}${chunk}`));
    child.stderr.on('data', (chunk) => logs.set(service, `${logs.get(service)}${chunk}`));
    children.push(child);
  }

  async function start() {
    for (const service of services) startService(service);

    await Promise.all([
      waitForHealth(`http://127.0.0.1:${ports.auth}/health`),
      waitForHealth(`http://127.0.0.1:${ports.crm}/health`),
      waitForHealth(`http://127.0.0.1:${ports.automation}/health`),
      waitForHealth(`http://127.0.0.1:${ports.messaging}/health`),
      waitForHealth(`http://127.0.0.1:${ports.ai}/health`),
      waitForHealth(`http://127.0.0.1:${ports.billing}/health`),
      waitForHealth(`http://127.0.0.1:${ports.team}/health`),
      waitForHealth(`http://127.0.0.1:${ports.livechat}/health`),
      waitForHealth(`http://127.0.0.1:${ports.broadcasts}/health`),
      waitForHealth(`http://127.0.0.1:${ports.integrations}/health`),
      waitForHealth(`http://127.0.0.1:${ports.publicApi}/health`),
      waitForHealth(`http://127.0.0.1:${ports.gateway}/health`)
    ]);
  }

  async function stop() {
    for (const child of children) {
      if (!child.killed) child.kill();
    }
    await delay(500);
    cleanTestData(runId);
  }

  async function request(pathname, options = {}) {
    const headers = {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    };

    const response = await fetch(`http://127.0.0.1:${ports.gateway}${pathname}`, {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    const text = await response.text();
    let body = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Keep text body for webhook verification and non-JSON responses.
    }

    return { status: response.status, body, headers: response.headers };
  }

  function dumpLogs() {
    return [...logs.entries()].map(([service, output]) => `\n--- ${service} ---\n${output}`).join('');
  }

  return {
    runId,
    ports,
    start,
    stop,
    request,
    dumpLogs
  };
}

module.exports = {
  createStack
};
