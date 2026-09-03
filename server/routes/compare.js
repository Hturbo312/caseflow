import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// 跨案例对比矩阵：行 = Schema 实体类型维度，列 = 案例，单元格 = 该维度的知识摘要与证据覆盖
// 说明：实体类型仍按名称匹配 entity_types（历史上 entity_type 是自由字符串），
//       未匹配上的实体计入 per-case unmatched，待概念映射层上线后收敛
router.get('/', authMiddleware, async (req, res) => {
  try {
    const schemaId = parseInt(req.query.schema_id, 10);
    const caseIds = (req.query.case_ids || '')
      .split(',').map(s => parseInt(s, 10)).filter(Number.isInteger);
    if (!schemaId || caseIds.length < 2) {
      return res.status(400).json({ error: '需要 schema_id 和至少 2 个 case_ids' });
    }
    if (caseIds.length > 6) {
      return res.status(400).json({ error: '最多同时对比 6 个案例' });
    }

    const [typesRes, casesRes, entsRes, evRes, relRes] = await Promise.all([
      pool.query('SELECT id, name, color FROM entity_types WHERE schema_id = $1 ORDER BY id', [schemaId]),
      pool.query('SELECT id, name, location, year, created_at FROM cases WHERE id = ANY($1::int[])', [caseIds]),
      pool.query(`SELECT id, case_id, name, entity_type, color, status
                  FROM case_entities WHERE case_id = ANY($1::int[])`, [caseIds]),
      pool.query(`SELECT ce.id AS entity_id, count(ev.id)::int AS cnt
                  FROM case_entities ce
                  LEFT JOIN evidence ev ON ev.entity_id = ce.id
                  WHERE ce.case_id = ANY($1::int[])
                  GROUP BY ce.id`, [caseIds]),
      pool.query(`SELECT case_id, count(*)::int AS cnt FROM case_relations
                  WHERE case_id = ANY($1::int[]) GROUP BY case_id`, [caseIds]),
    ]);

    const evByEntity = new Map(evRes.rows.map(r => [r.entity_id, Number(r.cnt)]));
    const relByCase = new Map(relRes.rows.map(r => [r.case_id, Number(r.cnt)]));

    const cells = {};
    for (const t of typesRes.rows) {
      for (const c of casesRes.rows) {
        cells[`${t.id}:${c.id}`] = { count: 0, evidence_count: 0, entities: [] };
      }
    }
    const unmatchedByCase = {};
    for (const c of casesRes.rows) unmatchedByCase[c.id] = 0;
    for (const e of entsRes.rows) {
      const type = typesRes.rows.find(t => t.name === e.entity_type);
      if (!type) { unmatchedByCase[e.case_id]++; continue; }
      const cell = cells[`${type.id}:${e.case_id}`];
      if (!cell) continue;
      cell.count++;
      cell.evidence_count += evByEntity.get(e.id) || 0;
      if (cell.entities.length < 8) {
        cell.entities.push({ id: e.id, name: e.name, color: e.color, status: e.status });
      }
    }

    const matrix = typesRes.rows.map(t => ({
      type_id: t.id,
      type_name: t.name,
      color: t.color,
      cells: casesRes.rows.map(c => ({ case_id: c.id, ...cells[`${t.id}:${c.id}`] }))
    }));

    res.json({
      schema_id: schemaId,
      cases: casesRes.rows
        .sort((a, b) => caseIds.indexOf(a.id) - caseIds.indexOf(b.id))
        .map(c => ({
          ...c,
          entity_count: entsRes.rows.filter(e => e.case_id === c.id).length,
          relation_count: relByCase.get(c.id) || 0,
          unmatched_entities: unmatchedByCase[c.id] || 0
        })),
      matrix
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
