const axios = require('axios');

function crmConfig() {
  return {
    baseUrl: process.env.CRM_BASE_URL,
    apiKey: process.env.CRM_API_KEY
  };
}

async function syncContact(contact, options = {}) {
  const config = crmConfig();
  const payload = {
    externalId: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email,
    tags: contact.tags || [],
    metadata: {
      ...(contact.metadata || {}),
      zapbotWorkspaceId: contact.workspaceId
    }
  };

  if (!config.baseUrl) {
    return {
      synced: false,
      mode: 'mock',
      reason: 'CRM_BASE_URL is not configured',
      payload
    };
  }

  const response = await axios.post(`${config.baseUrl.replace(/\/$/, '')}/contacts`, payload, {
    headers: {
      Authorization: config.apiKey ? `Bearer ${config.apiKey}` : undefined,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    timeout: Number(process.env.CRM_TIMEOUT_MS || 10000)
  });

  return {
    synced: true,
    status: response.status,
    data: response.data
  };
}

module.exports = {
  syncContact
};
