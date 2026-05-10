const { createServiceApp, startService } = require('../_shared/app');
const { requireAuthOrService } = require('../_shared/auth');
const { serviceClient } = require('../_shared/http');
const { normalizePhone } = require('../_shared/phone');
const { requestOrgId } = require('../_shared/tenant');
const { initDb, Message } = require('./db');
const { sendTextMessage, sendMediaMessage } = require('./whatsapp');
require('dotenv').config();

const app = createServiceApp('messaging-service');
const port = process.env.MESSAGING_PORT || 3004;

const crm = serviceClient(process.env.CRM_SERVICE_URL || 'http://localhost:3002');
const automation = serviceClient(process.env.AUTOMATION_SERVICE_URL || 'http://localhost:3003');
const ai = serviceClient(process.env.AI_SERVICE_URL || 'http://localhost:3005');

function serviceRequest(req) {
  return {
    headers: {
      'x-service-token': process.env.SERVICE_TOKEN || 'dev-service-token',
      'x-org-id': requestOrgId(req)
    }
  };
}

function getFirstTextMessage(payload) {
  const value = payload?.entry?.[0]?.changes?.[0]?.value;
  const message = value?.messages?.[0];
  const contact = value?.contacts?.[0];

  if (!message || message.type !== 'text') return null;

  return {
    providerMessageId: message.id,
    phone: normalizePhone(message.from),
    name: contact?.profile?.name,
    body: message.text?.body || '',
    rawPayload: payload
  };
}

async function persistOutbound(org, phone, body, providerMessageId) {
  await Message.create({
    orgId: org,
    phone,
    direction: 'outbound',
    type: 'text',
    body,
    providerMessageId
  });
}

async function sendAndStore(org, phone, body) {
  const sent = await sendTextMessage(phone, body);
  await persistOutbound(org, phone, body, sent.messages?.[0]?.id || sent.messageId);
  return sent;
}

async function sendMediaAndStore(org, phone, payload) {
  const sent = await sendMediaMessage(phone, payload);
  await Message.create({
    orgId: org,
    phone,
    direction: 'outbound',
    type: payload.type || 'document',
    body: payload.url,
    providerMessageId: sent.messages?.[0]?.id || sent.messageId,
    rawPayload: payload
  });
  return sent;
}

async function processInbound(req, message) {
  const org = requestOrgId(req);

  await crm.post(
    '/contacts',
    {
      phone: message.phone,
      name: message.name,
      tags: ['whatsapp'],
      metadata: { source: 'whatsapp' }
    },
    serviceRequest(req)
  );

  await Message.create({
    orgId: org,
    phone: message.phone,
    direction: 'inbound',
    type: 'text',
    body: message.body,
    providerMessageId: message.providerMessageId,
    rawPayload: message.rawPayload
  });

  const decision = await automation.post(
    '/engine/inbound',
    {
      phone: message.phone,
      text: message.body
    },
    serviceRequest(req)
  );

  if (decision.data.messages?.length) {
    for (const item of decision.data.messages) {
      await sendAndStore(org, message.phone, item.body);
    }
    return decision.data;
  }

  if (decision.data.ai) {
    const history = await Message.findAll({
      where: { orgId: org, phone: message.phone },
      order: [['createdAt', 'ASC']],
      limit: 20
    });
    const reply = await ai.post(
      '/chat/reply',
      {
        phone: message.phone,
        message: message.body,
        history
      },
      serviceRequest(req)
    );
    if (reply.data.reply) {
      await sendAndStore(org, message.phone, reply.data.reply);
    }
    return { ...decision.data, reply: reply.data.reply };
  }

  return decision.data;
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post('/webhook', async (req, res, next) => {
  try {
    const message = getFirstTextMessage(req.body);
    if (!message) return res.sendStatus(200);

    await processInbound(req, message);
    res.sendStatus(200);
  } catch (error) {
    next(error);
  }
});

app.use('/messages', requireAuthOrService);
app.use('/conversations', requireAuthOrService);
app.use('/flows', requireAuthOrService);

app.post('/messages/send', async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const sent =
      req.body.type && req.body.type !== 'text'
        ? await sendMediaAndStore(requestOrgId(req), phone, {
            type: req.body.type,
            url: req.body.value || req.body.url,
            caption: req.body.caption,
            filename: req.body.filename
          })
        : await sendAndStore(requestOrgId(req), phone, req.body.body || req.body.value);
    res.json(sent);
  } catch (error) {
    next(error);
  }
});

app.get('/conversations/:phone', async (req, res, next) => {
  try {
    const messages = await Message.findAll({
      where: { orgId: requestOrgId(req), phone: normalizePhone(req.params.phone) },
      order: [['createdAt', 'ASC']]
    });
    res.json(messages);
  } catch (error) {
    next(error);
  }
});

app.post('/flows/send', async (req, res, next) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const decision = await automation.post(
      '/engine/start-flow',
      {
        phone,
        flowId: req.body.flowId
      },
      serviceRequest(req)
    );

    for (const item of decision.data.messages || []) {
      await sendAndStore(requestOrgId(req), phone, item.body);
    }

    res.json(decision.data);
  } catch (error) {
    next(error);
  }
});

initDb()
  .then(() => startService(app, 'messaging-service', port))
  .catch((error) => {
    console.error('messaging-service failed to start', error);
    process.exit(1);
  });
