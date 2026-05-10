const express = require('express');
const { RagDocument, RagChunk } = require('../models');
const { requireAuth, tenantWhere } = require('../middleware/auth');
const { storeDocumentChunks } = require('../rag');

const router = express.Router();
router.use(requireAuth);

function chunkText(text, size = 1200) {
  const chunks = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks;
}

router.get('/documents', async (req, res, next) => {
  try {
    const documents = await RagDocument.findAll({
      where: tenantWhere(req),
      include: [{ model: RagChunk, as: 'chunks' }],
      order: [['updatedAt', 'DESC']]
    });
    res.json(documents);
  } catch (error) {
    next(error);
  }
});

router.post('/documents', async (req, res, next) => {
  try {
    const { title, source, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'Título e conteúdo são obrigatórios' });
    }

    const document = await RagDocument.create({ workspaceId: req.workspaceId, title, source, status: 'uploaded' });
    const chunks = chunkText(content).map((chunk, index) => ({
      workspaceId: req.workspaceId,
      RagDocumentId: document.id,
      content: chunk,
      metadata: { index }
    }));

    await RagChunk.bulkCreate(chunks);
    const vectorResult = await storeDocumentChunks(document, chunks);

    res.status(201).json({
      document,
      chunks: chunks.length,
      vectorResult
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
