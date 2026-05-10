const axios = require('axios');
require('dotenv').config();

const apiVersion = process.env.WHATSAPP_API_VERSION || 'v20.0';
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
const token = process.env.WHATSAPP_API_TOKEN;

const whatsappClient = axios.create({
  baseURL: `https://graph.facebook.com/${apiVersion}`,
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

async function sendTextMessage(to, body) {
  const dryRun =
    process.env.WHATSAPP_DRY_RUN === 'true' ||
    !phoneNumberId ||
    !token ||
    String(token).startsWith('replace-');

  if (dryRun) {
    return {
      dryRun: true,
      to,
      body,
      messageId: `dry_${Date.now()}`
    };
  }

  const response = await whatsappClient.post(`/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body
    }
  });

  return response.data;
}

async function sendMediaMessage(to, { type = 'document', url, caption, filename }) {
  const dryRun =
    process.env.WHATSAPP_DRY_RUN === 'true' ||
    !phoneNumberId ||
    !token ||
    String(token).startsWith('replace-');

  if (dryRun) {
    return {
      dryRun: true,
      to,
      type,
      url,
      caption,
      filename,
      messageId: `dry_media_${Date.now()}`
    };
  }

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type,
    [type]: {
      link: url,
      caption
    }
  };

  if (type === 'document' && filename) {
    payload.document.filename = filename;
  }

  const response = await whatsappClient.post(`/${phoneNumberId}/messages`, payload);
  return response.data;
}

module.exports = {
  sendTextMessage,
  sendMediaMessage
};
