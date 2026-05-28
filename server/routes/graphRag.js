import express from 'express';
import { graphRagSearch, getRelatedCases, extractSubgraph } from '../services/graphRag.js';

const router = express.Router();

// GraphRAG 混合检索
router.post('/search', async (req, res) => {
  const { query, schemaId, caseId, limit, threshold, depth } = req.body;
  if (!query) {
    return res.status(400).json({ error: 'query 是必需的' });
  }
  try {
    const result = await graphRagSearch(query, {
      schemaId,
      caseId,
      limit: limit || 15,
      threshold: threshold || 0.3,
      depth: depth || 1,
    });
    res.json(result);
  } catch (error) {
    console.error('GraphRAG search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 关联案例推荐
router.get('/recommend/:caseId', async (req, res) => {
  const { caseId } = req.params;
  const { limit, schemaId } = req.query;
  try {
    const result = await getRelatedCases(parseInt(caseId), {
      limit: limit ? parseInt(limit) : 10,
      schemaId: schemaId ? parseInt(schemaId) : undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('Recommend cases error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 子图提取
router.post('/subgraph', async (req, res) => {
  const { entityIds, depth, schemaId } = req.body;
  if (!entityIds || !Array.isArray(entityIds)) {
    return res.status(400).json({ error: 'entityIds 必须是数组' });
  }
  try {
    const result = await extractSubgraph(entityIds, {
      depth: depth || 1,
      schemaId: schemaId || 3,
    });
    res.json(result);
  } catch (error) {
    console.error('Subgraph extraction error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
