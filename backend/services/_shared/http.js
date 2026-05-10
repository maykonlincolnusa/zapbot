const axios = require('axios');
require('dotenv').config();

function serviceClient(baseURL, orgId = process.env.DEFAULT_ORG_ID || '1') {
  return axios.create({
    baseURL,
    timeout: Number(process.env.SERVICE_HTTP_TIMEOUT_MS || 10000),
    headers: {
      'x-service-token': process.env.SERVICE_TOKEN || 'dev-service-token',
      'x-org-id': orgId
    }
  });
}

module.exports = {
  serviceClient
};
