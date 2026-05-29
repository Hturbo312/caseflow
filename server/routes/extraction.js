import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as pipeline from '../services/extractionPipeline.js';
import { triggerAutoEmbed } from '../services/extractionPipeline.js';
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
    const { entities, autoEmbed = true } = req.body;
    if (!entities || !Array.isArray(entities)) return res.status(400).json({ error: 'entities 数组是必需的' });

    if (entities.length === 0) {
      return res.json({ success: true, entities: [] });
    }

    // 优化：使用单条批量 INSERT 代替 N 次独立查询
    const values = entities.map((e, i) => {
      const base = i * 4;
      return `($1, $${base + 2}, $${base + 3}, $${base + 4})`;
    }).join(', ');
    const params = [caseId];
    entities.forEach(e => {
      params.push(e.name, e.entityType, JSON.stringify(e.properties || {}));
    });

    const result = await pool.query(
      `INSERT INTO case_entities (case_id, name, entity_type, properties) VALUES ${values} RETURNING *`,
      params
    );

    // 实体保存完成后，自动触发嵌入生成（异步，不阻塞响应）
    if (autoEmbed && result.rows.length > 0) {
      triggerAutoEmbed(caseId, 'batch-save-entities').catch(e => console.error('[batch-save-entities] 自动嵌入失败:', e));
    }

    res.json({ success: true, entities: result.rows });
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

    // 防御性校验：只保存审核通过的关系（与 finalizeCase 保持一致）
    const approvedRelations = relations.filter(r => r.status === 'approved' || !r.status);
    if (approvedRelations.length === 0) {
      return res.json({ success: true, saved: 0, skipped: relations.map(r => ({ sourceName: r.sourceName, targetName: r.targetName, reason: '状态不是 approved' })), relations: [] });
    }

    // 优化：一次性查询所有涉及的实体名称，避免 N+1 查询
    const entityNames = [...new Set(approvedRelations.flatMap(r => [r.sourceName, r.targetName]).filter(Boolean))];
    if (entityNames.length === 0) {
      return res.json({ success: true, saved: 0, skipped: [], relations: [] });
    }

    const entitiesResult = await pool.query(
      'SELECT id, name FROM case_entities WHERE case_id = $1 AND name = ANY($2)',
      [caseId, entityNames]
    );
    const nameToId = new Map(entitiesResult.rows.map(r => [r.name, r.id]));

    // 优化：预查询已存在的关系，避免重复插入（case_relations 无唯一约束）
    const relTuples = approvedRelations
      .filter(r => r.sourceName && r.targetName && r.name)
      .map(r => {
        const sourceId = nameToId.get(r.sourceName);
        const targetId = nameToId.get(r.targetName);
        return sourceId && targetId ? { sourceId, targetId, relationType: r.name, rel: r } : null;
      })
      .filter(Boolean);

    if (relTuples.length === 0) {
      const allSkipped = approvedRelations.map(r => ({
        sourceName: r.sourceName, targetName: r.targetName,
        reason: '缺少必要字段 (sourceName/targetName/name)'
      }));
      return res.json({ success: true, saved: 0, skipped: allSkipped, relations: [] });
    }

    // 查询已存在的关系（避免重复插入）
    const existingQuery = `
      SELECT source_entity_id, target_entity_id, relation_type
      FROM case_relations
      WHERE case_id = $1
        AND (source_entity_id, target_entity_id, relation_type) IN (${
          relTuples.map((_, i) => `($${i * 3 + 2}, $${i * 3 + 3}, $${i * 3 + 4})`).join(', ')
        })
    `;
    const existingParams = [caseId, ...relTuples.flatMap(r => [r.sourceId, r.targetId, r.relationType])];
    const existingResult = await pool.query(existingQuery, existingParams);
    const existingSet = new Set(
      existingResult.rows.map(r => `${r.source_entity_id}-${r.target_entity_id}-${r.relation_type}`)
    );

    // 分离已存在和待插入的关系
    const toInsert = [];
    const skipped = [];
    for (const item of relTuples) {
      const key = `${item.sourceId}-${item.targetId}-${item.relationType}`;
      if (existingSet.has(key)) {
        skipped.push({ sourceName: item.rel.sourceName, targetName: item.rel.targetName, reason: '关系已存在' });
      } else {
        toInsert.push(item);
      }
    }

    // 批量 INSERT：单条查询代替 N 条
    let saved = [];
    if (toInsert.length > 0) {
      const values = toInsert.map((item, i) => {
        const base = i * 4;
        return `($1, $${base + 2}, $${base + 3}, $${base + 4})`;
      }).join(', ');
      const insertParams = [caseId, ...toInsert.flatMap(item => [item.sourceId, item.targetId, item.relationType])];
      const insertResult = await pool.query(
        `INSERT INTO case_relations (case_id, source_entity_id, target_entity_id, relation_type)
         VALUES ${values} RETURNING *`,
        insertParams
      );
      saved = insertResult.rows;
    }

    // 补充因实体未找到而跳过的关系
    for (const rel of approvedRelations) {
      if (!rel.sourceName || !rel.targetName || !rel.name) {
        skipped.push({ sourceName: rel.sourceName, targetName: rel.targetName, reason: '缺少必要字段 (sourceName/targetName/name)' });
      } else if (!nameToId.has(rel.sourceName) || !nameToId.has(rel.targetName)) {
        const missing = [];
        if (!nameToId.has(rel.sourceName)) missing.push(rel.sourceName);
        if (!nameToId.has(rel.targetName)) missing.push(rel.targetName);
        skipped.push({ sourceName: rel.sourceName, targetName: rel.targetName, reason: `实体未找到: ${missing.join(', ')}` });
      }
    }

    // 关系保存完成后，自动触发嵌入生成（异步，不阻塞响应）
    if (autoEmbed && saved.length > 0) {
      triggerAutoEmbed(caseId, 'batch-save-relations').catch(e => console.error('[batch-save-relations] 自动嵌入失败:', e));
    }

    res.json({ success: true, saved: saved.length, skipped, relations: saved });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取案例所有实体（用于关系审核时显示实体颜色）
router.get('/:caseId/entities', authMiddleware, async (req, res) => {
  try {
    const { caseId } = req.params;
    const result = await pool.query('SELECT id, name, entity_type, color FROM case_entities WHERE case_id = $1', [caseId]);
    res.json({ entities: result.rows });
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
