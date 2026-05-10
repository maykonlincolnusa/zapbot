const axios = require('axios');
const { PRODUCT_NAME } = require('./config/product');

const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION || 'v20.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

function whatsappConfig() {
  return {
    token: process.env.WHATSAPP_API_TOKEN,
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID
  };
}

function assertWhatsAppConfig() {
  const config = whatsappConfig();
  if (!config.token || !config.phoneNumberId) {
    throw new Error('Missing WHATSAPP_API_TOKEN or WHATSAPP_PHONE_NUMBER_ID');
  }
  return config;
}

async function sendTextMessage(to, text) {
  const config = whatsappConfig();

  if (!config.token || !config.phoneNumberId) {
    // Development mode: keep local flows testable without sending real WhatsApp messages.
    console.warn(`[${PRODUCT_NAME}] WhatsApp credentials not configured; skipping outbound send.`);
    return {
      id: `dev-${Date.now()}`,
      to,
      text,
      skipped: true
    };
  }

  const response = await axios.post(
    `${GRAPH_BASE_URL}/${config.phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: {
        preview_url: false,
        body: text
      }
    },
    {
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

async function sendTemplateMessage(to, templateName, languageCode = 'pt_BR', components = []) {
  const config = whatsappConfig();

  if (!config.token || !config.phoneNumberId) {
    console.warn(`[${PRODUCT_NAME}] WhatsApp credentials not configured; skipping outbound template send.`);
    return {
      id: `dev-template-${Date.now()}`,
      to,
      templateName,
      skipped: true
    };
  }

  const response = await axios.post(
    `${GRAPH_BASE_URL}/${config.phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components
      }
    },
    {
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

async function sendMediaMessage(to, media) {
  const config = whatsappConfig();
  const mediaType = media.type || media.mediaType || 'document';
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: mediaType,
    [mediaType]: {
      link: media.url || media.mediaUrl,
      caption: media.caption || undefined,
      filename: media.filename || undefined
    }
  };

  if (!payload[mediaType].link) {
    throw new Error('media.url or media.mediaUrl is required');
  }

  if (!config.token || !config.phoneNumberId) {
    console.warn(`[${PRODUCT_NAME}] WhatsApp credentials not configured; skipping outbound media send.`);
    return {
      id: `dev-media-${Date.now()}`,
      to,
      mediaType,
      skipped: true
    };
  }

  const response = await axios.post(`${GRAPH_BASE_URL}/${config.phoneNumberId}/messages`, payload, {
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json'
    }
  });

  return response.data;
}

async function sendInteractiveButtons(to, bodyText, buttons = []) {
  const config = assertWhatsAppConfig();
  const buttonPayload = buttons.slice(0, 3).map((button, index) => ({
    type: 'reply',
    reply: {
      id: button.id || button.value || String(index + 1),
      title: button.label || button.title || `Opcao ${index + 1}`
    }
  }));

  const response = await axios.post(
    `${GRAPH_BASE_URL}/${config.phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: bodyText },
        action: { buttons: buttonPayload }
      }
    },
    {
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

function verifyWebhook(query) {
  const mode = query['hub.mode'];
  const token = query['hub.verify_token'];
  const challenge = query['hub.challenge'];
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  return mode === 'subscribe' && token && verifyToken && token === verifyToken
    ? challenge
    : null;
}

function extractTextFromMessage(message) {
  if (message.text?.body) return message.text.body;
  if (message.button?.text) return message.button.text;
  if (message.interactive?.button_reply?.title) return message.interactive.button_reply.title;
  if (message.interactive?.list_reply?.title) return message.interactive.list_reply.title;
  return '';
}

function parseIncomingMessages(payload) {
  const messages = [];
  const entries = payload.entry || [];

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const message of value.messages || []) {
        messages.push({
          id: message.id,
          from: message.from,
          timestamp: message.timestamp,
          type: message.type,
          text: extractTextFromMessage(message),
          raw: message
        });
      }
    }
  }

  return messages;
}

function parseStatuses(payload) {
  const statuses = [];
  const entries = payload.entry || [];

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      for (const status of value.statuses || []) {
        statuses.push({
          id: status.id,
          recipientId: status.recipient_id,
          status: status.status,
          timestamp: status.timestamp,
          raw: status
        });
      }
    }
  }

  return statuses;
}

module.exports = {
  sendMessage: sendTextMessage,
  sendTextMessage,
  sendTemplate: sendTemplateMessage,
  sendTemplateMessage,
  sendFile: sendMediaMessage,
  sendMediaMessage,
  sendInteractiveButtons,
  verifyWebhook,
  parseIncomingMessages,
  parseStatuses
};
