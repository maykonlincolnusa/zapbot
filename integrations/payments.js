const axios = require('axios');

function paymentsConfig() {
  return {
    baseUrl: process.env.PAYMENT_GATEWAY_URL,
    apiKey: process.env.PAYMENT_GATEWAY_API_KEY,
    provider: process.env.PAYMENT_PROVIDER || 'mock'
  };
}

async function createPaymentLink(payload) {
  const config = paymentsConfig();

  if (!config.baseUrl || config.provider === 'mock') {
    return {
      provider: 'mock',
      url: `https://payments.example.local/checkout/${Date.now()}`,
      payload
    };
  }

  const response = await axios.post(`${config.baseUrl.replace(/\/$/, '')}/payment-links`, payload, {
    headers: {
      Authorization: config.apiKey ? `Bearer ${config.apiKey}` : undefined,
      'Content-Type': 'application/json'
    },
    timeout: Number(process.env.PAYMENT_TIMEOUT_MS || 10000)
  });

  return response.data;
}

module.exports = {
  createPaymentLink
};
