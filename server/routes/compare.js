import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { accessibleCaseIds } from '../middleware/caseAccess.js';

const router = express.Router();

// 所有比较接口统一验证案例集合，避免通过聚合接口绕过案例访问控制。
router.use(authMiddleware, async (req, res, next) => {
  try {
    const raw = req.query.case_ids || req.body?.case_ids || req.body?.case_id;
    if (raw == null) return next();
    const requested = (Array.isArray(raw) ? raw : String(raw).split(',')).map(Number).filter(Number.isInteger);
    const allowed = await accessibleCaseIds(req.user.id, requested);
    if (allowed.length !== [...new Set(requested)].length) return res.status(403).json({ error: '比较集包含当前用户无权访问的案例' });
    next();
  } catch (error) { res.status(403).json({ error: error.message }); }
});

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

// ============================================================
// 2.0 分析接口（Spec §6.6）：全部为确定性 SQL 聚合，AI 只做解释
// ============================================================

// 校验 case_ids 数组
function parseCaseIdArray(input, { min = 1, max = 50 } = {}) {
  const ids = (Array.isArray(input) ? input : String(input || '').split(','))
    .map(s => parseInt(s, 10)).filter(Number.isInteger);
  if (ids.length < min) return { error: `至少需要 ${min} 个案例` };
  if (ids.length > max) return { error: `最多支持 ${max} 个案例` };
  return { ids };
}

// 过程状态矩阵：案例 × 计划/试验/部署/采用/调整/扩散/暂停/退出（Spec §7.3-A）
router.post('/process-states', authMiddleware, async (req, res) => {
  try {
    const { ids, error } = parseCaseIdArray(req.body?.case_ids, { min: 1, max: 50 });
    if (error) return res.status(400).json({ error });
    const filters = Array.isArray(req.body?.process_state_filters) ? req.body.process_state_filters : null;

    const [casesRes, matrixRes] = await Promise.all([
      pool.query('SELECT id, name, location, year, case_status FROM cases WHERE id = ANY($1::int[])', [ids]),
      pool.query(`SELECT case_id, process_state, SUM(entity_count)::int AS entity_count
                  FROM v_process_state_matrix
                  WHERE case_id = ANY($1::int[])
                  ${filters ? 'AND process_state = ANY($2)' : ''}
                  GROUP BY case_id, process_state`, filters ? [ids, filters] : [ids]),
    ]);

    const states = ['planned', 'piloted', 'deployed', 'adopted', 'adjusted', 'scaled', 'suspended', 'withdrawn', 'unknown'];
    const byCase = new Map(casesRes.rows.map(c => [c.id, Object.fromEntries(states.map(s => [s, 0]))]));
    for (const r of matrixRes.rows) {
      if (byCase.has(r.case_id) && byCase.get(r.case_id)[r.process_state] !== undefined) {
        byCase.get(r.case_id)[r.process_state] = Number(r.entity_count);
      }
    }

    res.json({
      schema_version: 'Dynamic Schema v1.0',
      states,
      cases: casesRes.rows.map(c => ({ ...c, states: byCase.get(c.id) })),
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 证据覆盖图：案例 × 知识维度 × 证据状态（Spec §7.3-D，blocked 与 not_evidenced 分离）
router.post('/evidence-coverage', authMiddleware, async (req, res) => {
  try {
    const { ids, error } = parseCaseIdArray(req.body?.case_ids, { min: 1, max: 50 });
    if (error) return res.status(400).json({ error });
    const statusFilters = Array.isArray(req.body?.evidence_status_filters) ? req.body.evidence_status_filters : null;

    const [casesRes, covRes] = await Promise.all([
      pool.query('SELECT id, name, case_status FROM cases WHERE id = ANY($1::int[])', [ids]),
      pool.query(`SELECT case_id, dimension, evidence_status, SUM(entity_count)::int AS entity_count
                  FROM v_evidence_coverage
                  WHERE case_id = ANY($1::int[])
                    AND dimension <> 'other'
                  ${statusFilters ? 'AND evidence_status = ANY($2)' : ''}
                  GROUP BY case_id, dimension, evidence_status`, statusFilters ? [ids, statusFilters] : [ids]),
    ]);

    const dimensions = ['background', 'deployment', 'org_response', 'space_response', 'service_response', 'outcome'];
    const dimLabels = {
      background: '背景与任务', deployment: '技术与部署',
      org_response: '组织响应', space_response: '空间响应',
      service_response: '行为/服务响应', outcome: '结果与约束',
    };
    const statuses = ['confirmed', 'limited', 'blocked', 'not_evidenced'];

    const cells = {};
    for (const c of casesRes.rows) for (const d of dimensions) {
      cells[`${c.id}:${d}`] = Object.fromEntries(statuses.map(s => [s, 0]));
    }
    for (const r of covRes.rows) {
      const cell = cells[`${r.case_id}:${r.dimension}`];
      if (cell && cell[r.evidence_status] !== undefined) cell[r.evidence_status] += Number(r.entity_count);
    }

    res.json({
      schema_version: 'Dynamic Schema v1.0',
      dimensions: dimensions.map(d => ({ key: d, label: dimLabels[d] })),
      statuses,
      cases: casesRes.rows.map(c => ({
        ...c,
        coverage: Object.fromEntries(dimensions.map(d => [d, cells[`${c.id}:${d}`]])),
      })),
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 能力—任务热力图：技术能力经 supports_task 关系进入任务（Spec §7.3-B）
router.post('/capability-task', authMiddleware, async (req, res) => {
  try {
    const { ids, error } = parseCaseIdArray(req.body?.case_ids, { min: 1, max: 50 });
    if (error) return res.status(400).json({ error });

    const { rows } = await pool.query(
      `SELECT cr.case_id, c.name AS case_name,
              src.name AS capability, dst.name AS task,
              COUNT(*)::int AS link_count
       FROM case_relations cr
       JOIN case_entities src ON src.id = cr.source_entity_id
       JOIN case_entities dst ON dst.id = cr.target_entity_id
       JOIN cases c ON c.id = cr.case_id
       WHERE cr.case_id = ANY($1::int[])
         AND src.entity_type = 'Capability（技术能力）'
         AND dst.entity_type = 'Task（社区更新任务）'
         AND cr.status <> 'rejected'
       GROUP BY cr.case_id, c.name, src.name, dst.name
       ORDER BY cr.case_id`, [ids]);

    const capabilities = [...new Set(rows.map(r => r.capability))];
    const tasks = [...new Set(rows.map(r => r.task))];
    res.json({
      schema_version: 'Dynamic Schema v1.0',
      capabilities, tasks,
      links: rows,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 少量案例对照：共同结构、不同关系、缺失环节及关系 Evidence。
router.post('/contrast', authMiddleware, async (req, res) => {
  try {
    const { ids, error } = parseCaseIdArray(req.body?.case_ids, { min: 2, max: 6 });
    if (error) return res.status(400).json({ error });
    const [casesRes, relRes] = await Promise.all([
      pool.query('SELECT id,name FROM cases WHERE id=ANY($1::int[])', [ids]),
      pool.query(`SELECT cr.case_id,cr.id,cr.relation_type,cr.source_entity_id,cr.target_entity_id,
        s.name AS source_name,s.entity_type AS source_type,t.name AS target_name,t.entity_type AS target_type
        FROM case_relations cr JOIN case_entities s ON s.id=cr.source_entity_id JOIN case_entities t ON t.id=cr.target_entity_id
        WHERE cr.case_id=ANY($1::int[]) AND cr.status<>'rejected' ORDER BY cr.case_id,cr.id`, [ids]),
    ]);
    const signatures = new Map();
    for (const r of relRes.rows) {
      const key = `${r.source_type}::${r.relation_type}::${r.target_type}`;
      if (!signatures.has(key)) signatures.set(key, []);
      signatures.get(key).push(r);
    }
    const relations = [...signatures.entries()].map(([signature, rows]) => ({
      signature,
      cases: ids.map(caseId => ({ case_id: caseId, present: rows.some(r => r.case_id === caseId), examples: rows.filter(r => r.case_id === caseId).slice(0, 5) })),
      common: ids.every(caseId => rows.some(r => r.case_id === caseId)),
    }));
    res.json({ case_ids: ids, cases: casesRes.rows, common: relations.filter(r => r.common), differing: relations.filter(r => !r.common), generated_at: new Date().toISOString() });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 跨案例路径比较：返回完整路径、断点案例及关系证据计数。
router.post('/path', authMiddleware, async (req, res) => {
  try {
    const { ids, error } = parseCaseIdArray(req.body?.case_ids, { min: 2, max: 50 });
    if (error) return res.status(400).json({ error });
    const types = Array.isArray(req.body?.types) && req.body.types.length >= 2 ? req.body.types : [
      'Technology（技术）', 'Capability（技术能力）', 'Task（社区更新任务）', 'Action / Event（行动与事件）', 'Outcome（结果）'
    ];
    const [entitiesRes, relationsRes, evidenceRes] = await Promise.all([
      pool.query("SELECT id,case_id,name,entity_type,status FROM case_entities WHERE case_id=ANY($1::int[]) AND status<>'rejected'", [ids]),
      pool.query(`SELECT id,case_id,source_entity_id,target_entity_id,relation_type,status FROM case_relations
        WHERE case_id=ANY($1::int[]) AND status<>'rejected'`, [ids]),
      pool.query(`SELECT ev.relation_id,count(*)::int AS evidence_count,
        json_agg(json_build_object('id',ev.id,'quote',ev.quote,'status',ev.status,'document_title',d.title,'segment_id',ev.segment_id) ORDER BY ev.created_at DESC) AS evidence
        FROM evidence ev JOIN case_relations cr ON cr.id=ev.relation_id
        LEFT JOIN text_segments ts ON ts.id=ev.segment_id LEFT JOIN documents d ON d.id=ts.document_id
        WHERE cr.case_id=ANY($1::int[]) GROUP BY ev.relation_id`, [ids]),
    ]);
    const byCase = new Map(ids.map(id => [id, { entities: entitiesRes.rows.filter(e => e.case_id === id), relations: relationsRes.rows.filter(r => r.case_id === id) }]));
    const evidence = new Map(evidenceRes.rows.map(r => [r.relation_id, { count: Number(r.evidence_count), items: r.evidence || [] }]));
    const results = ids.map(caseId => {
      const graph = byCase.get(caseId); const paths = [];
      const walk = (current, index, edges) => {
        if (index === types.length - 1) { paths.push({ nodes: [...current], edges: [...edges] }); return; }
        const nextType = types[index + 1];
        const tail = current[current.length - 1];
        graph.relations.filter(r => r.source_entity_id === tail.id).forEach(r => {
          const target = graph.entities.find(e => e.id === r.target_entity_id && e.entity_type === nextType);
          if (target) walk([...current, target], index + 1, [...edges, { ...r, evidence_count: evidence.get(r.id)?.count || 0, evidence: evidence.get(r.id)?.items || [] }]);
        });
      };
      graph.entities.filter(e => e.entity_type === types[0]).forEach(start => walk([start], 0, []));
      return { case_id: caseId, complete: paths.length > 0, paths: paths.slice(0, 50), available_types: [...new Set(graph.entities.map(e => e.entity_type))] };
    });
    res.json({ schema_version: 'Dynamic Schema v1.0', types, cases: results, complete_case_ids: results.filter(r => r.complete).map(r => r.case_id), broken_case_ids: results.filter(r => !r.complete).map(r => r.case_id), generated_at: new Date().toISOString() });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 技术作用链：单案例按 情境→问题→任务→技术→能力→行动→响应→结果 主链排序返回（Spec §7.3-C）
router.post('/action-chain', authMiddleware, async (req, res) => {
  try {
    const caseId = parseInt(req.body?.case_id, 10);
    if (!caseId) return res.status(400).json({ error: 'case_id 必填' });

    const chainTypes = [
      'Community Context（社区情境）', 'Problem / Pressure（问题与压力）',
      'Task（社区更新任务）', 'Technology（技术）', 'Capability（技术能力）',
      'Action / Event（行动与事件）', 'Organizational Response（组织响应）',
      'Spatial Response（空间响应）', 'Behavioral / Service Response（行为与服务响应）',
      'Outcome（结果）', 'Constraint / Adjustment（约束与调整）',
    ];
    const [entsRes, evRes] = await Promise.all([
      pool.query(
        `SELECT id, name, entity_type, color, properties, status FROM case_entities
         WHERE case_id = $1 AND status <> 'rejected' AND entity_type = ANY($2)`,
        [caseId, chainTypes]),
      pool.query(
        `SELECT ev.entity_id, ev.status AS evidence_status, count(*)::int AS cnt
         FROM evidence ev JOIN case_entities ce ON ce.id = ev.entity_id
         WHERE ce.case_id = $1 GROUP BY ev.entity_id, ev.status`, [caseId]),
    ]);

    const evByEntity = new Map();
    for (const r of evRes.rows) {
      const cur = evByEntity.get(r.entity_id) || {};
      cur[r.evidence_status] = Number(r.cnt);
      evByEntity.set(r.entity_id, cur);
    }

    res.json({
      schema_version: 'Dynamic Schema v1.0',
      chain_order: chainTypes,
      entities: entsRes.rows.map(e => ({ ...e, evidence: evByEntity.get(e.id) || {} })),
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
