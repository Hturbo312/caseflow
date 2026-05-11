import express from 'express';
import pool from '../db.js';
import { aiConfigCache, PORT } from '../config.js';

const router = express.Router();

// 获取嵌入统计
router.get('/stats', async (req, res) => {
  try {
    const entityStats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(embedding) as embedded,
        COUNT(*) - COUNT(embedding) as pending
      FROM case_entities
    `);

    const caseStats = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(embedding) as embedded,
        COUNT(*) - COUNT(embedding) as pending
      FROM cases
    `);

    res.json({
      entities: entityStats.rows[0],
      cases: caseStats.rows[0],
      embeddingConfigured: !!(aiConfigCache.apiKey && aiConfigCache.embeddingEndpoint),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 为实体生成嵌入
router.post('/embed-entities', async (req, res) => {
  const { caseId, force = false } = req.body;

  try {
    let query = `SELECT id, name, entity_type, properties FROM case_entities WHERE 1=1`;
    const params = [];
    if (caseId) {
      query += ` AND case_id = $1`;
      params.push(caseId);
    }
    if (!force) {
      query += params.length ? ` AND embedding IS NULL` : ` WHERE embedding IS NULL`;
    }

    const entitiesResult = await pool.query(query, params);
    const entities = entitiesResult.rows;

    if (entities.length === 0) {
      return res.json({ message: '没有需要生成嵌入的实体', count: 0 });
    }

    const texts = entities.map(e => {
      const props = e.properties || {};
      const propText = Object.entries(props).map(([k, v]) => `${k}: ${v}`).join(', ');
      return `${e.name} (${e.entity_type})${propText ? '. ' + propText : ''}`;
    });

    const embedResponse = await fetch(`http://localhost:${PORT}/api/ai/embedding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts }),
    });

    const embedData = await embedResponse.json();
    if (embedData.error) {
      return res.status(500).json({ error: embedData.error });
    }

    const embeddings = embedData.data?.map(d => d.embedding) || [];
    for (let i = 0; i < entities.length; i++) {
      const embedding = embeddings[i];
      if (embedding) {
        await pool.query(
          `UPDATE case_entities SET embedding = $1 WHERE id = $2`,
          [`[${embedding.join(',')}]`, entities[i].id]
        );
      }
    }

    res.json({ message: `成功为 ${entities.length} 个实体生成嵌入`, count: entities.length });
  } catch (error) {
    console.error('Embed entities error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 混合检索API
router.post('/search', async (req, res) => {
  const { query, schemaId, caseId, limit = 10, threshold = 0.5 } = req.body;

  if (!query) {
    return res.status(400).json({ error: 'query 是必需的' });
  }

  try {
    const embedResponse = await fetch(`http://localhost:${PORT}/api/ai/embedding`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: [query] }),
    });

    const embedData = await embedResponse.json();
    if (embedData.error) {
      return res.status(500).json({ error: embedData.error });
    }

    const queryVector = embedData.data?.[0]?.embedding;
    if (!queryVector) {
      return res.status(500).json({ error: '生成查询向量失败' });
    }

    let entityQuery = `
      SELECT e.id, e.name, e.entity_type, e.properties, e.case_id, c.name as case_name,
             1 - (e.embedding <=> $1::vector) as similarity
      FROM case_entities e
      JOIN cases c ON e.case_id = c.id
      WHERE e.embedding IS NOT NULL AND 1 - (e.embedding <=> $1::vector) > $2
    `;
    const entityParams = [`[${queryVector.join(',')}]`, threshold];
    let idx = 3;

    if (schemaId) {
      entityQuery += ` AND c.schema_id = $${idx}`;
      entityParams.push(schemaId);
      idx++;
    }
    if (caseId) {
      entityQuery += ` AND e.case_id = $${idx}`;
      entityParams.push(caseId);
      idx++;
    }
    entityQuery += ` ORDER BY similarity DESC LIMIT $${idx}`;
    entityParams.push(limit);

    const entitiesResult = await pool.query(entityQuery, entityParams);

    let caseQuery = `
      SELECT id, name, description, 1 - (embedding <=> $1::vector) as similarity
      FROM cases WHERE embedding IS NOT NULL AND 1 - (embedding <=> $1::vector) > $2
    `;
    const caseParams = [`[${queryVector.join(',')}]`, threshold];
    idx = 3;
    if (schemaId) {
      caseQuery += ` AND schema_id = $${idx}`;
      caseParams.push(schemaId);
    }
    caseQuery += ` ORDER BY similarity DESC LIMIT 5`;

    const casesResult = await pool.query(caseQuery, caseParams);

    const entityIds = entitiesResult.rows.map(e => e.id);
    let relationsResult = { rows: [] };

    if (entityIds.length > 0) {
      const relQuery = `
        SELECT r.id, r.relation_type, s.name as source_name, t.name as target_name
        FROM case_relations r
        JOIN case_entities s ON r.source_entity_id = s.id
        JOIN case_entities t ON r.target_entity_id = t.id
        WHERE r.source_entity_id = ANY($1) OR r.target_entity_id = ANY($1)
      `;
      relationsResult = await pool.query(relQuery, [entityIds]);
    }

    res.json({
      query,
      entities: entitiesResult.rows.map(e => ({
        id: e.id, name: e.name, type: e.entity_type, properties: e.properties,
        caseId: e.case_id, caseName: e.case_name, similarity: parseFloat(e.similarity.toFixed(4)),
      })),
      cases: casesResult.rows.map(c => ({
        id: c.id, name: c.name, description: c.description, similarity: parseFloat(c.similarity.toFixed(4)),
      })),
      relations: relationsResult.rows.map(r => ({
        id: r.id, type: r.relation_type, source: r.source_name, target: r.target_name,
      })),
    });
  } catch (error) {
    console.error('RAG search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GraphRAG 问答
router.post('/ask', async (req, res) => {
  const { question, schemaId, caseId } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'question 是必需的' });
  }

  try {
    const searchResponse = await fetch(`http://localhost:${PORT}/api/rag/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: question, schemaId, caseId, limit: 15 }),
    });

    const searchResult = await searchResponse.json();
    if (searchResult.error) {
      return res.status(500).json({ error: searchResult.error });
    }

    const contextParts = [];
    if (searchResult.entities?.length > 0) {
      contextParts.push('相关实体：');
      searchResult.entities.slice(0, 10).forEach(e => {
        const props = Object.entries(e.properties || {}).map(([k, v]) => `${k}:${v}`).join(', ');
        contextParts.push(`- ${e.name} (${e.type})${props ? `: ${props}` : ''}`);
      });
    }
    if (searchResult.relations?.length > 0) {
      contextParts.push('\n相关关系：');
      searchResult.relations.slice(0, 10).forEach(r => {
        contextParts.push(`- ${r.source} --[${r.type}]--> ${r.target}`);
      });
    }
    if (searchResult.cases?.length > 0) {
      contextParts.push('\n相关案例：');
      searchResult.cases.slice(0, 5).forEach(c => {
        contextParts.push(`- ${c.name}: ${(c.description || '').slice(0, 100)}...`);
      });
    }

    const systemPrompt = `你是知识图谱分析助手。基于以下检索结果回答问题：
${contextParts.join('\n') || '没有找到相关信息'}

请基于以上信息回答，并标注来源。`;

    const llmResponse = await fetch(`http://localhost:${PORT}/api/ai/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: question }],
      }),
    });

    const llmData = await llmResponse.json();
    if (llmData.error) {
      return res.status(500).json({ error: llmData.error });
    }

    res.json({
      answer: llmData.choices?.[0]?.message?.content || '无法生成回答',
      sources: { entities: searchResult.entities?.slice(0, 5) || [], relations: searchResult.relations?.slice(0, 5) || [], cases: searchResult.cases?.slice(0, 3) || [] },
    });
  } catch (error) {
    console.error('RAG ask error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;