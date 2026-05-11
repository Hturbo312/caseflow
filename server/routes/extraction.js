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

// 解析文本（构建 Text IR）- 需要较长超时时间（LLM 调用）
router.post('/:caseId/parse-text', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const { caseText, schemaId } = req.body;
    if (!caseText) return res.status(400).json({ error: 'caseText 是必需的' });

    // 设置较长超时（AI 调用可达 10 分钟）
    req.socket.setTimeout(660000); // 11 分钟，略长于 AI 超时
    res.setTimeout(660000);

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
    const result = await pipeline.finalizeCase(caseId);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

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
