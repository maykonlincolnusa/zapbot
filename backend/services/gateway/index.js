const axios = require('axios');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { createServiceApp, startService } = require('../_shared/app');
require('dotenv').config();

const app = createServiceApp('api-gateway', { json: false });
const port = process.env.GATEWAY_PORT || process.env.PORT || 3000;

const services = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  crm: process.env.CRM_SERVICE_URL || 'http://localhost:3002',
  automation: process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3003',
  messaging: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004',
  ai: process.env.AI_SERVICE_URL || 'http://localhost:3005',
  billing: process.env.BILLING_SERVICE_URL || 'http://localhost:3006',
  team: process.env.TEAM_SERVICE_URL || 'http://localhost:3007',
  livechat: process.env.LIVECHAT_SERVICE_URL || 'http://localhost:3008',
  broadcasts: process.env.BROADCASTS_SERVICE_URL || 'http://localhost:3009',
  integrations: process.env.INTEGRATIONS_SERVICE_URL || 'http://localhost:3010',
  publicApi: process.env.PUBLIC_API_SERVICE_URL || 'http://localhost:3011'
};

const serviceCatalog = {
  auth: {
    url: services.auth,
    capabilities: ['register', 'login', 'jwt', 'organization']
  },
  crm: {
    url: services.crm,
    capabilities: ['contacts', 'tags', 'custom-fields', 'assignments', 'deals', 'tasks']
  },
  automation: {
    url: services.automation,
    capabilities: ['flows', 'sequences', 'campaigns', 'robot-fields', 'inbound-engine']
  },
  messaging: {
    url: services.messaging,
    capabilities: ['whatsapp-webhook', 'send-message', 'send-flow', 'conversation-history']
  },
  ai: {
    url: services.ai,
    capabilities: ['agents', 'multi-llm-routing', 'gpt', 'claude', 'gemini', 'grok', 'sales-reply', 'lead-score', 'crm-insights']
  },
  billing: {
    url: services.billing,
    capabilities: ['plans', 'subscriptions', 'checkout', 'payment-webhook']
  },
  team: {
    url: services.team,
    capabilities: ['managers', 'permissions', 'online-status']
  },
  livechat: {
    url: services.livechat,
    capabilities: ['open-close-conversation', 'assignment', 'queues', 'notes']
  },
  broadcasts: {
    url: services.broadcasts,
    capabilities: ['broadcasts', 'segments', 'scheduling', 'delivery-jobs']
  },
  integrations: {
    url: services.integrations,
    capabilities: ['inbound-webhooks', 'outbound-webhooks', 'execution-logs', 'payload-mapping']
  },
  publicApi: {
    url: services.publicApi,
    capabilities: ['api-key', 'contacts-api', 'automation-actions', 'external-systems']
  }
};

function proxy(target, stripPrefix) {
  const options = {
    target,
    changeOrigin: true,
    on: {
      error(error, req, res) {
        res.status(502).json({ error: `Service unavailable: ${target}`, detail: error.message });
      }
    }
  };

  if (stripPrefix) {
    options.pathRewrite = {
      [`^${stripPrefix}`]: ''
    };
  }

  return createProxyMiddleware({
    ...options
  });
}

function webhookProxy(target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite(pathname) {
      return `/webhook${pathname === '/' ? '' : pathname}`;
    },
    on: {
      error(error, req, res) {
        res.status(502).json({ error: `Service unavailable: ${target}`, detail: error.message });
      }
    }
  });
}

app.get('/api/services', (req, res) => {
  res.json({
    gateway: 'ok',
    services: serviceCatalog
  });
});

app.get('/api/service-registry', async (req, res) => {
  const entries = await Promise.all(
    Object.entries(serviceCatalog).map(async ([name, service]) => {
      try {
        const response = await axios.get(`${service.url}/health`, { timeout: 1500 });
        return {
          name,
          url: service.url,
          status: response.data.ok ? 'healthy' : 'degraded',
          capabilities: service.capabilities
        };
      } catch (error) {
        return {
          name,
          url: service.url,
          status: 'unavailable',
          capabilities: service.capabilities,
          error: error.message
        };
      }
    })
  );

  res.json({
    gateway: 'healthy',
    services: entries
  });
});

app.use('/api/auth', proxy(services.auth, '/api/auth'));
app.use('/api/crm', proxy(services.crm, '/api/crm'));
app.use('/api/automation', proxy(services.automation, '/api/automation'));
app.use('/api/messaging', proxy(services.messaging, '/api/messaging'));
app.use('/api/ai', proxy(services.ai, '/api/ai'));
app.use('/api/billing', proxy(services.billing, '/api/billing'));
app.use('/api/team', proxy(services.team, '/api/team'));
app.use('/api/livechat', proxy(services.livechat, '/api/livechat'));
app.use('/api/broadcasts', proxy(services.broadcasts, '/api/broadcasts'));
app.use('/api/integrations', proxy(services.integrations, '/api/integrations'));
app.use('/public/v1', proxy(services.publicApi, '/public/v1'));

// Public webhook entrypoint expected by Meta WhatsApp Cloud API.
app.use('/webhook', webhookProxy(services.messaging));

startService(app, 'api-gateway', port);
