import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { assertCaseAccess, accessibleCaseIds } from '../middleware/caseAccess.js';

const router = express.Router();

/**
 * L3 概念层 API（Spec §2.3/§4.4/§7.2）
 * 共享概念（concepts）= 跨案例比较坐标系的坐标系节点，挂在 Schema 家族上、跨版本存活；
 * 概念映射（concept_mappings）= 案例原生术语 → 共享概念，按 (case_id, native_term) 记录，
 * 一个原生术语（=案例实体名）映射后，同名实体全部进入该概念的跨案例对齐。
 * 自动建议只做确定性字符串匹配（全等 / 别名 / 包含），由研究者确认后落库。
 */

// 默认家族：优先「使用中」的 schema 版本所属家族，否则论文家族
async function resolveFamilyId(explicit) {
  if (explicit) return Number(explicit);
  const active = await pool.query(
    `SELECT v.family_id FROM schema_versions v
     WHERE v.status = 'active'
     ORDER BY v.approved_at DESC NULLS LAST, v.id DESC LIMIT 1`);
  if (active.rows.length > 0) return active.rows[0].family_id;
  const fam = await pool.query(`SELECT id FROM schema_families WHERE key = 'thesis_dynamic_schema'`);
  return fam.rows[0]?.id || null;
}

const slugKey = (label) => {
  const slug = String(label || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return slug || `concept_${Date.now().toString(36)}`;
};

// ============ 共享概念 ============
router.get('/', async (req, res) => {
  try {
    const familyId = await resolveFamilyId(req.query.family_id);
    if (!familyId) return res.json({ family_id: null, concepts: [] });
    const { rows } = await pool.query(
      `SELECT c.id, c.key, c.label, c.aliases,
              (SELECT COUNT(*)::int FROM concept_mappings m WHERE m.concept_id = c.id) AS mapping_count
       FROM concepts c WHERE c.family_id = $1 ORDER BY c.label`, [familyId]);
    res.json({ family_id: familyId, concepts: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { label, aliases, key, family_id } = req.body;
    if (!label || !String(label).trim()) return res.status(400).json({ error: 'label 必填' });
    const familyId = await resolveFamilyId(family_id);
    if (!familyId) return res.status(400).json({ error: '无法定位 Schema 家族' });
    const aliasList = Array.isArray(aliases) ? aliases.map(a => String(a).trim()).filter(Boolean) : [];
    const k = String(key || '').trim() || slugKey(label);
    try {
      const { rows } = await pool.query(
        `INSERT INTO concepts (family_id, schema_id, key, label, aliases)
         VALUES ($1, NULL, $2, $3, $4::jsonb) RETURNING *`,
        [familyId, k, String(label).trim(), JSON.stringify(aliasList)]);
      res.json({ concept: rows[0] });
    } catch (e) {
      if (e.code === '23505' || e.code === '23P01') {
        return res.status(409).json({ error: `概念 key「${k}」已存在` });
      }
      throw e;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // 概念删除会级联删除其映射（DB ON DELETE CASCADE），先报出受影响映射数
    const cnt = await pool.query('SELECT COUNT(*)::int AS n FROM concept_mappings WHERE concept_id = $1', [req.params.id]);
    const { rows } = await pool.query('DELETE FROM concepts WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '概念不存在' });
    res.json({ message: '概念已删除', affected_mappings: cnt.rows[0].n });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 案例原生术语 → 共享概念 映射 ============
router.get('/mappings', authMiddleware, async (req, res) => {
  try {
    const caseId = parseInt(req.query.case_id, 10);
    if (!caseId) return res.status(400).json({ error: 'case_id 必填' });
    await assertCaseAccess(req.user.id, caseId);
    const { rows } = await pool.query(
      `SELECT m.id, m.native_term, m.concept_id, m.mapping_type, m.confidence, m.verified,
              c.label AS concept_label, c.key AS concept_key
       FROM concept_mappings m JOIN concepts c ON c.id = m.concept_id
       WHERE m.case_id = $1 ORDER BY m.native_term`, [caseId]);
    res.json({ mappings: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/mappings', authMiddleware, async (req, res) => {
  try {
    const { case_id, native_term, concept_id, mapping_type, confidence, verified } = req.body;
    if (!case_id || !native_term || !concept_id) {
      return res.status(400).json({ error: 'case_id / native_term / concept_id 必填' });
    }
    await assertCaseAccess(req.user.id, case_id, ['owner', 'editor']);
    const term = String(native_term).trim();
    const { rows } = await pool.query(
      `INSERT INTO concept_mappings (case_id, native_term, concept_id, mapping_type, confidence, verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (case_id, native_term, concept_id)
       DO UPDATE SET mapping_type = EXCLUDED.mapping_type, confidence = EXCLUDED.confidence, verified = EXCLUDED.verified
       RETURNING *`,
      [case_id, term, concept_id, mapping_type || 'manual', confidence ?? 1.0, verified ?? true]);
    res.json({ mapping: rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/mappings/bulk', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { case_id, items } = req.body;
    if (!case_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'case_id 和非空 items 必填' });
    }
    let applied = 0;
    await client.query('BEGIN');
    for (const it of items) {
      if (!it?.native_term || !it?.concept_id) continue;
      await client.query(
        `INSERT INTO concept_mappings (case_id, native_term, concept_id, mapping_type, confidence, verified)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (case_id, native_term, concept_id) DO NOTHING`,
        [case_id, String(it.native_term).trim(), it.concept_id,
         it.mapping_type || 'suggested', it.confidence ?? null, it.verified ?? false]);
      applied++;
    }
    await client.query('COMMIT');
    res.json({ applied });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

router.delete('/mappings/:id', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM concept_mappings WHERE id = $1 RETURNING id', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: '映射不存在' });
    res.json({ message: '映射已删除' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 自动映射建议（确定性匹配，研究者确认后生效） ============
router.get('/suggestions', authMiddleware, async (req, res) => {
  try {
    const caseId = parseInt(req.query.case_id, 10);
    if (!caseId) return res.status(400).json({ error: 'case_id 必填' });
    await assertCaseAccess(req.user.id, caseId);
    const familyId = await resolveFamilyId(req.query.family_id);
    if (!familyId) return res.json({ suggestions: [] });

    const [namesRes, conceptsRes, mappedRes] = await Promise.all([
      pool.query(
        `SELECT ce.name AS native_term, COUNT(*)::int AS entity_count
         FROM case_entities ce
         WHERE ce.case_id = $1 AND ce.status <> 'rejected'
         GROUP BY ce.name`, [caseId]),
      pool.query(`SELECT id, label, aliases FROM concepts WHERE family_id = $1`, [familyId]),
      pool.query(`SELECT native_term FROM concept_mappings WHERE case_id = $1`, [caseId]),
    ]);

    const mappedTerms = new Set(mappedRes.rows.map(r => r.native_term));
    const concepts = conceptsRes.rows.map(c => ({ ...c, aliases: c.aliases || [] }));
    const suggestions = [];
    for (const { native_term, entity_count } of namesRes.rows) {
      if (mappedTerms.has(native_term)) continue;
      const term = String(native_term);
      let best = null;
      for (const c of concepts) {
        let confidence = 0, basis = null;
        if (term === c.label) { confidence = 1.0; basis = 'exact'; }
        else if (c.aliases.includes(term)) { confidence = 0.9; basis = 'alias'; }
        else if (term.length >= 2 && c.label.length >= 2 &&
                 (term.includes(c.label) || c.label.includes(term))) { confidence = 0.65; basis = 'contains'; }
        else {
          const hit = c.aliases.find(a => a.length >= 2 && (term.includes(a) || a.includes(term)));
          if (hit) { confidence = 0.6; basis = 'alias_contains'; }
        }
        if (confidence > 0 && (!best || confidence > best.confidence)) {
          best = { concept_id: c.id, concept_label: c.label, confidence, basis };
        }
      }
      if (best) suggestions.push({ native_term, entity_count, ...best });
    }
    suggestions.sort((a, b) => b.entity_count - a.entity_count || b.confidence - a.confidence);
    res.json({ suggestions: suggestions.slice(0, 100) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 跨案例概念对齐矩阵（共享概念 × 案例，比较坐标系） ============
router.get('/coverage', authMiddleware, async (req, res) => {
  try {
    const caseIds = (req.query.case_ids || '').split(',').map(s => parseInt(s, 10)).filter(Number.isInteger);
    if (caseIds.length < 1) return res.status(400).json({ error: '需要至少 1 个 case_ids' });
    if (caseIds.length > 50) return res.status(400).json({ error: '最多同时对比 50 个案例' });
    const allowed = await accessibleCaseIds(req.user.id, caseIds);
    if (allowed.length !== caseIds.length) return res.status(403).json({ error: '案例集包含无权访问的案例' });
    const familyId = await resolveFamilyId(req.query.family_id);
    if (!familyId) return res.json({ family_id: null, concepts: [], cases: [], matrix: {}, case_totals: {}, gaps: {} });

    const [conceptsRes, casesRes, covRes, totalsRes, gapsRes] = await Promise.all([
      pool.query(`SELECT id, key, label, aliases FROM concepts WHERE family_id = $1 ORDER BY label`, [familyId]),
      pool.query(`SELECT id, name, location, year FROM cases WHERE id = ANY($1::int[])`, [caseIds]),
      pool.query(
        `SELECT m.concept_id, ce.case_id, COUNT(DISTINCT ce.id)::int AS entity_count,
                ARRAY_AGG(DISTINCT ce.name) AS native_terms
         FROM concept_mappings m
         JOIN case_entities ce ON ce.case_id = m.case_id AND ce.name = m.native_term
         WHERE ce.case_id = ANY($1::int[]) AND ce.status <> 'rejected'
         GROUP BY m.concept_id, ce.case_id`, [caseIds]),
      pool.query(
        `SELECT ce.case_id, COUNT(*)::int AS entities,
                COUNT(*) FILTER (WHERE m.id IS NOT NULL)::int AS mapped_entities
         FROM case_entities ce
         LEFT JOIN concept_mappings m ON m.case_id = ce.case_id AND m.native_term = ce.name
         WHERE ce.case_id = ANY($1::int[]) AND ce.status <> 'rejected'
         GROUP BY ce.case_id`, [caseIds]),
      pool.query(
        `SELECT ce.case_id, ce.name AS native_term, COUNT(*)::int AS entity_count
         FROM case_entities ce
         LEFT JOIN concept_mappings m ON m.case_id = ce.case_id AND m.native_term = ce.name
         WHERE ce.case_id = ANY($1::int[]) AND ce.status <> 'rejected' AND m.id IS NULL
         GROUP BY ce.case_id, ce.name
         ORDER BY ce.case_id, entity_count DESC`, [caseIds]),
    ]);

    const matrix = {};
    for (const r of covRes.rows) {
      matrix[`${r.concept_id}:${r.case_id}`] = {
        entity_count: r.entity_count,
        native_terms: (r.native_terms || []).slice(0, 6),
      };
    }
    const case_totals = Object.fromEntries(totalsRes.rows.map(r => [String(r.case_id), {
      entities: r.entities, mapped: r.mapped_entities, unmapped: r.entities - r.mapped_entities,
    }]));
    const gaps = {};
    for (const r of gapsRes.rows) {
      (gaps[r.case_id] = gaps[r.case_id] || []).push({ native_term: r.native_term, entity_count: r.entity_count });
    }
    for (const k of Object.keys(gaps)) gaps[k] = gaps[k].slice(0, 60);

    res.json({
      family_id: familyId,
      concepts: conceptsRes.rows,
      cases: casesRes.rows.sort((a, b) => caseIds.indexOf(a.id) - caseIds.indexOf(b.id)),
      matrix, case_totals, gaps,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
