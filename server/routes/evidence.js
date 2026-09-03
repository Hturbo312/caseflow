import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// 批量证据计数：案例内各实体/关系的证据条数（CaseLibrary 证据完整度徽标用）
router.get('/counts', authMiddleware, async (req, res) => {
  try {
    const caseId = parseInt(req.query.case_id, 10);
    if (!caseId) return res.status(400).json({ error: 'case_id 必填' });
    const [entRes, relRes] = await Promise.all([
      pool.query(`SELECT ev.entity_id AS id, count(*)::int AS cnt, count(*) FILTER (WHERE ev.status = 'confirmed')::int AS confirmed
                  FROM evidence ev JOIN case_entities ce ON ce.id = ev.entity_id
                  WHERE ce.case_id = $1 GROUP BY ev.entity_id`, [caseId]),
      pool.query(`SELECT ev.relation_id AS id, count(*)::int AS cnt
                  FROM evidence ev JOIN case_relations cr ON cr.id = ev.relation_id
                  WHERE cr.case_id = $1 GROUP BY ev.relation_id`, [caseId]),
    ]);
    res.json({
      by_entity: Object.fromEntries(entRes.rows.map(r => [String(r.id), { total: r.cnt, confirmed: r.confirmed }])),
      by_relation: Object.fromEntries(relRes.rows.map(r => [String(r.id), { total: r.cnt, confirmed: r.cnt }])),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取实体或关系的证据链：逐字引文 + 原文分段定位 + 文档出处
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { entity_id, relation_id } = req.query;
    if (!entity_id && !relation_id) {
      return res.status(400).json({ error: 'entity_id 或 relation_id 必填其一' });
    }
    const cond = entity_id ? 'e.entity_id = $1' : 'e.relation_id = $1';
    const { rows } = await pool.query(
      `SELECT e.id, e.quote, e.char_start, e.char_end, e.confidence, e.source, e.status, e.metadata, e.created_at,
              s.id AS segment_id, s.content AS segment_content, s.page, s.segment_index,
              d.id AS document_id, d.title AS document_title, d.source_type, d.uri
       FROM evidence e
       LEFT JOIN text_segments s ON e.segment_id = s.id
       LEFT JOIN documents d ON s.document_id = d.id
       WHERE ${cond}
       ORDER BY e.created_at DESC`,
      [entity_id || relation_id]
    );
    res.json({ evidence: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 事实断言链：实体/关系 ← 事实断言 ← 原子事实 ← 原文分段（Spec §4.5，L1↔L2 版本化关联）
router.get('/facts', authMiddleware, async (req, res) => {
  try {
    const { entity_id, relation_id } = req.query;
    if (!entity_id && !relation_id) {
      return res.status(400).json({ error: 'entity_id 或 relation_id 必填其一' });
    }
    const isEntity = Boolean(entity_id);
    const table = isEntity ? 'fact_entity_assertions' : 'fact_relation_assertions';
    const col = isEntity ? 'entity_id' : 'relation_id';
    const { rows } = await pool.query(
      `SELECT fa.id AS assertion_id, fa.assertion_status, fa.schema_version_id,
              af.id AS fact_id, af.fact_text, af.fact_type, af.status AS fact_status,
              af.metadata, af.created_at,
              s.id AS segment_id, s.content AS segment_content, s.page, s.segment_index,
              d.id AS document_id, d.title AS document_title
       FROM ${table} fa
       JOIN atomic_facts af ON af.id = fa.fact_id
       LEFT JOIN text_segments s ON s.id = af.segment_id
       LEFT JOIN documents d ON s.document_id = d.id
       WHERE fa.${col} = $1
       ORDER BY af.created_at DESC`,
      [entity_id || relation_id]);
    res.json({ facts: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
