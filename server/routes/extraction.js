import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as pipeline from '../services/extractionPipeline.js';
import pool from '../db.js';

const router = express.Router();

// 获取提取进度
router.get('/:caseId/progress', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const progress = await pipeline.getExtractionProgress(caseId);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Schema 分析
router.post('/:caseId/schema-analyze', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { schemaId } = req.body;
    if (!schemaId) return res.status(400).json({ error: 'schemaId 是必需的' });

    const result = await pipeline.runSchemaAnalysis(schemaId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 解析文本（构建 Text IR）- 纯规则切分，无需 LLM，使用默认超时
router.post('/:caseId/parse-text', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { caseText, schemaId } = req.body;
    if (!caseText) return res.status(400).json({ error: 'caseText 是必需的' });

    const result = await pipeline.parseCaseText(caseId, caseText, schemaId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 生成提取计划
router.post('/:caseId/plan', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { schemaId } = req.body;
    if (!schemaId) return res.status(400).json({ error: 'schemaId 是必需的' });

    const result = await pipeline.generateExtractionPlan(caseId, schemaId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取提取计划
router.get('/:caseId/plan', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const memResult = await pool.query('SELECT extraction_progress FROM case_memory WHERE case_id = $1', [caseId]);
    const progress = memResult.rows[0]?.extraction_progress || {};
    res.json({ plan: progress.plan || null, progress });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 批量并行提取所有类型实体（LLM 调用，长时间操作）
router.post('/:caseId/extract-all', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { schemaId } = req.body;
    if (!schemaId) return res.status(400).json({ error: 'schemaId 是必需的' });

    req.socket.setTimeout(660000);
    res.setTimeout(660000);

    const result = await pipeline.extractAllEntities(caseId, schemaId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 提取某类实体（LLM 调用）
router.post('/:caseId/extract/:entityType', authMiddleware, async (req, res) => {
  try {
    const { caseId, entityType } = req.params;
    const { schemaId } = req.body;
    if (!schemaId) return res.status(400).json({ error: 'schemaId 是必需的' });

    req.socket.setTimeout(660000);
    res.setTimeout(660000);

    const result = await pipeline.extractEntities(caseId, entityType, schemaId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 一致性检查
router.post('/:caseId/check-consistency/:entityType', authMiddleware, async (req, res) => {
  try {
    const { caseId, entityType } = req.params;
    const { candidates } = req.body;
    if (!candidates) return res.status(400).json({ error: 'candidates 是必需的' });

    const result = await pipeline.checkConsistency(caseId, entityType, candidates);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 关系推断（LLM 调用）
router.post('/:caseId/infer-relations', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { schemaId, candidates } = req.body;
    if (!schemaId) return res.status(400).json({ error: 'schemaId 是必需的' });

    req.socket.setTimeout(660000);
    res.setTimeout(660000);

    const result = await pipeline.inferRelations(caseId, schemaId, candidates);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 保存实体
router.post('/:caseId/save-entity', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { name, entityType, properties } = req.body;
    if (!name || !entityType) return res.status(400).json({ error: 'name 和 entityType 是必需的' });

    const result = await pool.query(
      'INSERT INTO case_entities (case_id, name, entity_type, properties) VALUES ($1, $2, $3, $4) RETURNING *',
      [caseId, name, entityType, JSON.stringify(properties || {})]
    );
    res.json({ success: true, entity: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 批量保存实体
router.post('/:caseId/batch-save-entities', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { entities } = req.body;
    if (!entities || !Array.isArray(entities)) return res.status(400).json({ error: 'entities 数组是必需的' });

    const saved = [];
    for (const e of entities) {
      const result = await pool.query(
        'INSERT INTO case_entities (case_id, name, entity_type, properties) VALUES ($1, $2, $3, $4) RETURNING *',
        [caseId, e.name, e.entityType, JSON.stringify(e.properties || {})]
      );
      saved.push(result.rows[0]);
    }
    res.json({ success: true, entities: saved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 保存关系
router.post('/:caseId/save-relation', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { sourceEntityId, targetEntityId, relationType } = req.body;
    if (!sourceEntityId || !targetEntityId || !relationType) {
      return res.status(400).json({ error: 'sourceEntityId, targetEntityId, relationType 是必需的' });
    }

    const result = await pool.query(
      'INSERT INTO case_relations (case_id, source_entity_id, target_entity_id, relation_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [caseId, sourceEntityId, targetEntityId, relationType]
    );
    res.json({ success: true, relation: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 完成提取
router.post('/:caseId/finalize', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { relations = [], autoEmbed = true } = req.body;
    const result = await pipeline.finalizeCase(caseId, { relations, autoEmbed });
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 批量保存关系（供前端在 finalize 前保存审核通过的关系）
router.post('/:caseId/batch-save-relations', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { relations, autoEmbed = true } = req.body;
    if (!relations || !Array.isArray(relations)) {
      return res.status(400).json({ error: 'relations 数组是必需的' });
    }

    // 优化：一次性查询所有涉及的实体名称，避免 N+1 查询
    const entityNames = [...new Set(relations.flatMap(r => [r.sourceName, r.targetName]))];
    if (entityNames.length === 0) {
      return res.json({ success: true, saved: 0, skipped: [], relations: [] });
    }

    const entitiesResult = await pool.query(
      'SELECT id, name FROM case_entities WHERE case_id = $1 AND name = ANY($2)',
      [caseId, entityNames]
    );
    const nameToId = new Map(entitiesResult.rows.map(r => [r.name, r.id]));

    const saved = [];
    const skipped = [];
    for (const rel of relations) {
      const sourceId = nameToId.get(rel.sourceName);
      const targetId = nameToId.get(rel.targetName);

      if (sourceId && targetId) {
        const result = await pool.query(
          'INSERT INTO case_relations (case_id, source_entity_id, target_entity_id, relation_type) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING *',
          [caseId, sourceId, targetId, rel.name]
        );
        if (result.rows.length > 0) saved.push(result.rows[0]);
      } else {
        const missing = [];
        if (!sourceId) missing.push(rel.sourceName);
        if (!targetId) missing.push(rel.targetName);
        skipped.push({ sourceName: rel.sourceName, targetName: rel.targetName, reason: `实体未找到: ${missing.join(', ')}` });
      }
    }

    // 关系保存完成后，自动触发嵌入生成（异步，不阻塞响应）
    if (autoEmbed && saved.length > 0) {
      triggerEmbedAfterRelations(caseId).catch(e => console.error('[batch-save-relations] 自动嵌入失败:', e));
    }

    res.json({ success: true, saved: saved.length, skipped, relations: saved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 关系保存后异步触发嵌入（复用 extractionPipeline 的内部函数）
async function triggerEmbedAfterRelations(caseId) {
  const { PORT } = await import('../config.js');
  try {
    const response = await fetch(`http://localhost:${PORT}/api/rag/embed-entities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, force: false }),
    });
    if (response.ok) {
      const data = await response.json();
      console.log(`[batch-save-relations] 自动嵌入完成: ${data.count || 0} 个实体`);
    }
  } catch (e) {
    console.error('[batch-save-relations] 嵌入触发异常:', e.message);
  }
}

// 获取文本片段（溯源查看）
router.get('/:caseId/segments', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const result = await pool.query('SELECT * FROM text_segments WHERE case_id = $1 ORDER BY segment_index', [caseId]);
    res.json({ segments: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取案例记忆
router.get('/:caseId/memory', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const result = await pool.query('SELECT * FROM case_memory WHERE case_id = $1', [caseId]);
    res.json({ memory: result.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取 Schema 记忆
router.get('/schema/:schemaId/memory', authMiddleware, async (req, res) => {
  try {
    const { schemaId } = req.params;
    const result = await pool.query('SELECT * FROM schema_memory WHERE schema_id = $1 ORDER BY version DESC LIMIT 1', [schemaId]);
    res.json({ memory: result.rows[0] || null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
