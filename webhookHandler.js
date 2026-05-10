const { getDefaultWorkspace, Message, WebhookEvent } = require('./models');
const { parseIncomingMessages, parseStatuses } = require('./whatsapp');

async function persistEvent(workspaceId, eventType, event) {
  return WebhookEvent.create({
    workspaceId,
    eventType,
    whatsappMessageId: event.id,
    contactPhone: event.from || event.recipientId || null,
    status: event.status || null,
    payload: event.raw || event,
    processedAt: new Date()
  });
}

async function applyStatusEvent(workspaceId, status) {
  await persistEvent(workspaceId, 'status', status);

  const messages = await Message.findAll({
    where: {
      workspaceId,
      whatsappMessageId: status.id
    }
  });

  for (const message of messages) {
    await message.update({
      status: status.status,
      metadata: {
        ...(message.metadata || {}),
        whatsappStatus: status.raw,
        statusUpdatedAt: new Date().toISOString()
      }
    });
  }

  if (!messages.length) {
    await Message.create({
      workspaceId,
      direction: 'status',
      body: `[status:${status.status}]`,
      whatsappMessageId: status.id,
      status: status.status,
      metadata: status.raw
    });
  }
}

async function handleWhatsAppWebhook(payload, options = {}) {
  const workspace = await getDefaultWorkspace();
  const statuses = parseStatuses(payload);
  const messages = parseIncomingMessages(payload);
  const results = [];

  for (const status of statuses) {
    await applyStatusEvent(workspace.id, status);
  }

  for (const message of messages) {
    await persistEvent(workspace.id, 'message', message);

    if (options.processIncomingMessage) {
      results.push(await options.processIncomingMessage(message));
    }
  }

  return {
    workspaceId: workspace.id,
    messages: messages.length,
    statuses: statuses.length,
    results
  };
}

module.exports = {
  handleWhatsAppWebhook,
  persistEvent
};
