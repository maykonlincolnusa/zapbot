const { createServiceApp, startService } = require('../_shared/app');
const { requireApiKey } = require('../_shared/apiKey');
const { serviceClient } = require('../_shared/http');
const { normalizePhone } = require('../_shared/phone');
const { requestOrgId } = require('../_shared/tenant');
require('dotenv').config();

const app = createServiceApp('public-api-service');
const port = process.env.PUBLIC_API_PORT || 3011;

const crm = serviceClient(process.env.CRM_SERVICE_URL || 'http://localhost:3002');
const automation = serviceClient(process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3003');
const messaging = serviceClient(process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004');
const team = serviceClient(process.env.TEAM_SERVICE_URL || 'http://localhost:3007');
const livechat = serviceClient(process.env.LIVECHAT_SERVICE_URL || 'http://localhost:3008');

app.use(requireApiKey);

function serviceHeaders(req) {
  return {
    headers: {
      'x-service-token': process.env.SERVICE_TOKEN || 'dev-service-token',
      'x-org-id': requestOrgId(req)
    }
  };
}

app.post('/contacts', async (req, res, next) => {
  try {
    const contact = await crm.post(
      '/contacts',
      {
        phone: req.body.phone,
        name: req.body.name || [req.body.firstName, req.body.lastName].filter(Boolean).join(' '),
        email: req.body.email,
        tags: req.body.tags || [],
        metadata: req.body.metadata || {}
      },
      serviceHeaders(req)
    );
    res.status(201).json(contact.data);
  } catch (error) {
    next(error);
  }
});

app.get('/contacts', async (req, res, next) => {
  try {
    const contacts = await crm.get('/contacts', serviceHeaders(req));
    res.json(contacts.data);
  } catch (error) {
    next(error);
  }
});

app.get('/contacts/by-phone/:phone', async (req, res, next) => {
  try {
    const contact = await crm.get(`/contacts/by-phone/${normalizePhone(req.params.phone)}`, serviceHeaders(req));
    res.json(contact.data);
  } catch (error) {
    if (error.response?.status === 404) return res.sendStatus(404);
    next(error);
  }
});

app.delete('/contacts/:id', async (req, res, next) => {
  try {
    await crm.delete(`/contacts/${req.params.id}`, serviceHeaders(req));
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.post('/contacts/:id/tags', async (req, res, next) => {
  try {
    const contact = await crm.post(`/contacts/${req.params.id}/tags`, { tags: req.body.tags || [] }, serviceHeaders(req));
    res.json(contact.data);
  } catch (error) {
    next(error);
  }
});

app.post('/contacts/:id/custom-fields/:fieldId', async (req, res, next) => {
  try {
    const contact = await crm.post(
      `/contacts/${req.params.id}/custom-fields/${req.params.fieldId}`,
      { value: req.body.value },
      serviceHeaders(req)
    );
    res.json(contact.data);
  } catch (error) {
    next(error);
  }
});

app.delete('/contacts/:id/custom-fields/:fieldId', async (req, res, next) => {
  try {
    await crm.delete(`/contacts/${req.params.id}/custom-fields/${req.params.fieldId}`, serviceHeaders(req));
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.post('/contacts/:id/send-message', async (req, res, next) => {
  try {
    const contact = await crm.get(`/contacts/${req.params.id}`, serviceHeaders(req));
    const sent = await messaging.post(
      '/messages/send',
      {
        phone: contact.data.phone,
        type: req.body.type || 'text',
        body: req.body.body,
        value: req.body.value || req.body.body,
        url: req.body.url,
        caption: req.body.caption,
        filename: req.body.filename
      },
      serviceHeaders(req)
    );
    res.json(sent.data);
  } catch (error) {
    next(error);
  }
});

app.post('/contacts/:id/send-flow', async (req, res, next) => {
  try {
    const contact = await crm.get(`/contacts/${req.params.id}`, serviceHeaders(req));
    const sent = await messaging.post('/flows/send', { phone: contact.data.phone, flowId: req.body.flowId }, serviceHeaders(req));
    res.json(sent.data);
  } catch (error) {
    next(error);
  }
});

app.post('/contacts/:id/sequences/:sequenceId', async (req, res, next) => {
  try {
    const contact = await crm.get(`/contacts/${req.params.id}`, serviceHeaders(req));
    const result = await automation.post(`/subscribers/${contact.data.phone}/sequences/${req.params.sequenceId}`, {}, serviceHeaders(req));
    res.status(201).json(result.data);
  } catch (error) {
    next(error);
  }
});

app.delete('/contacts/:id/sequences/:sequenceId', async (req, res, next) => {
  try {
    const contact = await crm.get(`/contacts/${req.params.id}`, serviceHeaders(req));
    await automation.delete(`/subscribers/${contact.data.phone}/sequences/${req.params.sequenceId}`, serviceHeaders(req));
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.post('/contacts/:id/campaigns/:campaignId', async (req, res, next) => {
  try {
    const contact = await crm.get(`/contacts/${req.params.id}`, serviceHeaders(req));
    const result = await automation.post(`/subscribers/${contact.data.phone}/campaigns/${req.params.campaignId}`, {}, serviceHeaders(req));
    res.status(201).json(result.data);
  } catch (error) {
    next(error);
  }
});

app.delete('/contacts/:id/campaigns/:campaignId', async (req, res, next) => {
  try {
    const contact = await crm.get(`/contacts/${req.params.id}`, serviceHeaders(req));
    await automation.delete(`/subscribers/${contact.data.phone}/campaigns/${req.params.campaignId}`, serviceHeaders(req));
    res.sendStatus(204);
  } catch (error) {
    next(error);
  }
});

app.post('/contacts/:id/conversation-status', async (req, res, next) => {
  try {
    const contact = await crm.get(`/contacts/${req.params.id}`, serviceHeaders(req));
    const conversation = await livechat.post(
      `/conversations/${contact.data.phone}/status`,
      {
        openConversation: req.body.open,
        managerId: req.body.managerId,
        assignedTo: req.body.assignedTo
      },
      serviceHeaders(req)
    );
    res.json(conversation.data);
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/tags', async (req, res, next) => {
  try {
    const tags = await crm.get('/tags', serviceHeaders(req));
    res.json(tags.data);
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/custom-fields', async (req, res, next) => {
  try {
    const fields = await crm.get('/custom-fields', serviceHeaders(req));
    res.json(fields.data);
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/flows', async (req, res, next) => {
  try {
    const flows = await automation.get('/flows', serviceHeaders(req));
    res.json(flows.data);
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/sequences', async (req, res, next) => {
  try {
    const sequences = await automation.get('/sequences', serviceHeaders(req));
    res.json(sequences.data);
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/campaigns', async (req, res, next) => {
  try {
    const campaigns = await automation.get('/campaigns', serviceHeaders(req));
    res.json(campaigns.data);
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/robot-fields', async (req, res, next) => {
  try {
    const fields = await automation.get('/robot-fields', serviceHeaders(req));
    res.json(fields.data);
  } catch (error) {
    next(error);
  }
});

app.post('/robot-fields/:id/value', async (req, res, next) => {
  try {
    const field = await automation.post(`/robot-fields/${req.params.id}/value`, { value: req.body.value }, serviceHeaders(req));
    res.json(field.data);
  } catch (error) {
    next(error);
  }
});

app.get('/managers', async (req, res, next) => {
  try {
    const managers = await team.get('/managers', serviceHeaders(req));
    res.json(managers.data);
  } catch (error) {
    next(error);
  }
});

app.post('/managers', async (req, res, next) => {
  try {
    const manager = await team.post('/managers', req.body, serviceHeaders(req));
    res.status(201).json(manager.data);
  } catch (error) {
    next(error);
  }
});

startService(app, 'public-api-service', port);
