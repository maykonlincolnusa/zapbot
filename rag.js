const axios = require('axios');
const { PRODUCT_NAME } = require('./config/product');

function qdrantConfig() {
  return {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collection: process.env.QDRANT_COLLECTION || 'zapbot_documents'
  };
}

async function retrieveRelevantPassages(query, limit = 3) {
  const config = qdrantConfig();

  if (!config.url) {
    return [];
  }

  // TODO: Generate an embedding for `query`, then call Qdrant /points/search with that vector.
  // This placeholder keeps the integration boundary explicit without forcing a vector DB in local MVP runs.
  console.warn(`[${PRODUCT_NAME}] Qdrant is configured, but embedding/search wiring is still TODO.`);
  return [];
}

async function storeDocumentChunks(document, chunks = []) {
  const config = qdrantConfig();

  if (!config.url) {
    return { stored: false, reason: 'QDRANT_URL is not configured' };
  }

  // TODO: Generate embeddings for chunks and upsert them into Qdrant.
  // Prefer batching and idempotent vector IDs based on document ID + chunk index.
  await axios.get(config.url, {
    headers: config.apiKey ? { 'api-key': config.apiKey } : undefined,
    timeout: 2500
  });

  return {
    stored: false,
    reason: 'Qdrant health check passed; vector upsert is pending',
    documentId: document.id,
    chunks: chunks.length
  };
}

module.exports = {
  retrieveRelevantPassages,
  storeDocumentChunks
};
