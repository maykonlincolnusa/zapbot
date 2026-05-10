const express = require('express');
const { sequelize, dialect, WebhookEvent, IntegrationServer } = require('../models');
const { requireAuth, requireRole, tenantWhere } = require('../middleware/auth');
const { PRODUCT_NAME } = require('../config/product');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole('owner', 'admin', 'manager'));

function configured(...values) {
  return values.every((value) => Boolean(String(value || '').trim()));
}

function healthStatus(ok, degraded = false) {
  if (ok) return 'operational';
  return degraded ? 'degraded' : 'not_configured';
}

router.get('/', async (req, res, next) => {
  try {
    const started = Date.now();
    let database = { status: 'degraded', dialect, latencyMs: null, error: null };

    try {
      const dbStarted = Date.now();
      await sequelize.authenticate();
      database = {
        status: 'operational',
        dialect,
        latencyMs: Date.now() - dbStarted,
        migrations: process.env.DB_SYNC_ALTER === 'true' ? 'sync_alter_enabled' : 'managed_externally'
      };
    } catch (error) {
      database.error = 'Banco de dados indisponivel';
    }

    const [latestWebhookEvent, integrations] = await Promise.all([
      WebhookEvent.findOne({ where: tenantWhere(req), order: [['createdAt', 'DESC']] }),
      IntegrationServer.findAll({ where: tenantWhere(req) })
    ]);

    const whatsappConfigured = configured(process.env.WHATSAPP_API_TOKEN, process.env.WHATSAPP_PHONE_NUMBER_ID);
    const aiConfigured = Boolean(process.env.OPENAI_API_KEY || process.env.OPENROUTER_API_KEY);
    const mcpConfigured = Boolean(process.env.SERVICE_TOKEN || process.env.API_INTEGRATION_KEY);
    const storageConfigured = Boolean(process.env.S3_BUCKET || process.env.R2_BUCKET || process.env.MINIO_ENDPOINT);
    const redisConfigured = Boolean(process.env.REDIS_URL);

    const connectedIntegrations = integrations.filter((item) => item.active).length;
    const failingIntegrations = integrations.filter((item) => item.metadata?.lastError).length;

    res.json({
      productName: PRODUCT_NAME,
      generatedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
      services: {
        whatsapp: {
          status: healthStatus(whatsappConfigured),
          connected: whatsappConfigured,
          webhook: configured(process.env.WHATSAPP_VERIFY_TOKEN) ? 'configured' : 'missing_verify_token',
          lastEventAt: latestWebhookEvent?.createdAt || null,
          lastStatus: latestWebhookEvent?.status || null,
          phoneNumberConfigured: Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID)
        },
        database,
        queues: {
          status: healthStatus(redisConfigured, true),
          backend: redisConfigured ? 'redis' : 'node-cron-local',
          pendingJobs: null,
          failedJobs: null,
          note: redisConfigured ? 'Redis configurado' : 'BullMQ/Redis ainda nao configurado; schedulers locais em uso'
        },
        ai: {
          status: healthStatus(aiConfigured, true),
          openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
          openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
          defaultModel: process.env.OPENROUTER_DEFAULT_MODEL || process.env.OPENAI_MODEL || null
        },
        integrations: {
          status: failingIntegrations ? 'degraded' : 'operational',
          total: integrations.length,
          connected: connectedIntegrations,
          failing: failingIntegrations
        },
        storage: {
          status: healthStatus(storageConfigured, true),
          provider: process.env.S3_BUCKET ? 's3' : process.env.R2_BUCKET ? 'r2' : process.env.MINIO_ENDPOINT ? 'minio' : 'not_configured'
        },
        realtime: {
          status: 'operational',
          transport: 'sse',
          endpoint: '/api/chats/events'
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
