const axios = require('axios');
const crm = require('./crm');
const mcpClient = require('./mcpClient');
const payments = require('./payments');

function configuredConnectors() {
  return [
    {
      id: 'crm',
      name: 'CRM REST',
      configured: Boolean(process.env.CRM_BASE_URL),
      requiredEnv: ['CRM_BASE_URL', 'CRM_API_KEY']
    },
    {
      id: 'payments',
      name: 'Gateway de pagamentos',
      configured: Boolean(process.env.PAYMENT_GATEWAY_URL) || process.env.PAYMENT_PROVIDER === 'mock',
      requiredEnv: ['PAYMENT_PROVIDER', 'PAYMENT_GATEWAY_URL', 'PAYMENT_GATEWAY_API_KEY']
    },
    {
      id: 'generic-rest',
      name: 'Acao REST generica',
      configured: true,
      requiredEnv: []
    },
    {
      id: 'generic-graphql',
      name: 'Acao GraphQL generica',
      configured: true,
      requiredEnv: []
    },
    {
      id: 'external-mcp',
      name: 'Servidores MCP externos',
      configured: true,
      requiredEnv: ['MCP_CONNECTOR_TIMEOUT_MS']
    }
  ];
}

async function callRest({ url, method = 'POST', headers = {}, body }) {
  if (!url) throw new Error('url is required');

  const response = await axios({
    url,
    method,
    headers,
    data: body,
    timeout: Number(process.env.INTEGRATION_TIMEOUT_MS || 15000)
  });

  return {
    status: response.status,
    data: response.data
  };
}

async function callGraphql({ endpoint, query, variables = {}, headers = {} }) {
  if (!endpoint) throw new Error('endpoint is required');
  if (!query) throw new Error('query is required');

  return callRest({
    url: endpoint,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers
    },
    body: { query, variables }
  });
}

module.exports = {
  configuredConnectors,
  callRest,
  callGraphql,
  mcpClient,
  crm,
  payments
};
