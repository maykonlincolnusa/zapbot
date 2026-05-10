const express = require('express');
const { Contact, IntegrationServer } = require('../models');
const { requireServiceOrUserAuth, requireRole, tenantWhere } = require('../middleware/auth');
const { validateBody, schemas } = require('../middleware/validation');
const integrations = require('../integrations');

const router = express.Router();
router.use(requireServiceOrUserAuth);
router.use(requireRole('service', 'owner', 'admin'));

router.get('/', (req, res) => {
  res.json({
    connectors: integrations.configuredConnectors(),
    samples: integrations.mcpClient.sampleConnectors(),
    notes: [
      'Use webhooks de fluxo ou sistemas externos para chamar estes endpoints com bearer token.',
      'As rotas REST e GraphQL genéricas são adaptadores finos; valide payloads por conector antes de produção.'
    ]
  });
});

function publicIntegration(server) {
  return {
    id: server.id,
    name: server.name,
    provider: server.provider,
    endpointUrl: server.endpointUrl,
    authType: server.authType,
    active: server.active,
    availableTools: server.availableTools || [],
    eventMappings: server.eventMappings || [],
    lastDiscoveredAt: server.lastDiscoveredAt,
    metadata: server.metadata || {},
    createdAt: server.createdAt,
    updatedAt: server.updatedAt
  };
}

router.get('/servers', async (req, res, next) => {
  try {
    const servers = await IntegrationServer.findAll({
      where: tenantWhere(req),
      order: [['updatedAt', 'DESC']]
    });
    res.json(servers.map(publicIntegration));
  } catch (error) {
    next(error);
  }
});

router.post('/servers', validateBody(schemas.integrationServer), async (req, res, next) => {
  try {
    const { name, provider, endpointUrl, authType, authToken, eventMappings, active, metadata } = req.body;
    if (!name || !endpointUrl) return res.status(400).json({ error: 'Nome e endpointUrl são obrigatórios' });

    const server = await IntegrationServer.create({
      workspaceId: req.workspaceId,
      name,
      provider: provider || 'custom',
      endpointUrl,
      authType: authType || 'bearer',
      authToken: authToken || null,
      eventMappings: Array.isArray(eventMappings) ? eventMappings : [],
      active: active !== false,
      metadata: metadata || {}
    });

    res.status(201).json(publicIntegration(server));
  } catch (error) {
    next(error);
  }
});

router.put('/servers/:id', async (req, res, next) => {
  try {
    const server = await IntegrationServer.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!server) return res.status(404).json({ error: 'Servidor de integração não encontrado' });

    await server.update({
      name: req.body.name ?? server.name,
      provider: req.body.provider ?? server.provider,
      endpointUrl: req.body.endpointUrl ?? server.endpointUrl,
      authType: req.body.authType ?? server.authType,
      authToken: req.body.authToken === undefined ? server.authToken : req.body.authToken,
      eventMappings: req.body.eventMappings === undefined ? server.eventMappings : req.body.eventMappings,
      active: req.body.active ?? server.active,
      metadata: req.body.metadata ?? server.metadata
    });

    res.json(publicIntegration(server));
  } catch (error) {
    next(error);
  }
});

router.post('/servers/:id/discover', async (req, res, next) => {
  try {
    const server = await IntegrationServer.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!server) return res.status(404).json({ error: 'Servidor de integração não encontrado' });

    const tools = await integrations.mcpClient.discoverTools(server);
    await server.update({
      availableTools: tools,
      lastDiscoveredAt: new Date()
    });

    res.json(publicIntegration(server));
  } catch (error) {
    next(error);
  }
});

router.post('/servers/:id/invoke', async (req, res, next) => {
  try {
    const server = await IntegrationServer.findOne({ where: tenantWhere(req, { id: req.params.id }) });
    if (!server) return res.status(404).json({ error: 'Servidor de integração não encontrado' });
    if (!req.body.toolName) return res.status(400).json({ error: 'toolName é obrigatório' });

    const result = await integrations.mcpClient.invokeTool(server, req.body.toolName, req.body.arguments || {});
    res.json({
      server: publicIntegration(server),
      toolName: req.body.toolName,
      result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/crm/sync-contact', async (req, res, next) => {
  try {
    const contact = await Contact.findOne({ where: tenantWhere(req, { id: req.body.contactId }) });
    if (!contact) return res.status(404).json({ error: 'Contato não encontrado' });

    const result = await integrations.crm.syncContact(contact, req.body.options || {});
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/payments/link', async (req, res, next) => {
  try {
    const result = await integrations.payments.createPaymentLink({
      workspaceId: req.workspaceId,
      contactId: req.body.contactId || null,
      amount: req.body.amount,
      currency: req.body.currency || 'BRL',
      description: req.body.description,
      metadata: req.body.metadata || {}
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/rest', async (req, res, next) => {
  try {
    const result = await integrations.callRest(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.post('/graphql', async (req, res, next) => {
  try {
    const result = await integrations.callGraphql(req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
