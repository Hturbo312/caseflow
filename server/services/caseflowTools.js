import pool from '../db.js';

export const caseflowToolDefinitions = [
  { name: 'get_current_case', description: '读取当前用户可访问的案例及其实体、关系摘要', input: { case_id: 'number' } },
  { name: 'get_selected_cases', description: '读取当前用户可访问的比较案例摘要', input: { case_ids: 'number[]' } },
  { name: 'get_evidence', description: '读取当前用户可访问实体或关系的证据回溯链', input: { entity_id: 'number', relation_id: 'number' } },
  { name: 'compare_cases', description: '读取当前用户可访问案例的实体与关系对照摘要', input: { case_ids: 'number[]' } },
  { name: 'compare_paths', description: '跨案例查找指定实体类型链路，并返回完整、断开案例及关系证据', input: { case_ids: 'number[]', types: 'string[]' } },
  { name: 'focus_node', description: '根据实体 ID 返回聚焦节点及其相关关系，供工作台进入 Ego 视图', input: { entity_id: 'number' } },
];
const ids = (value, max = 50) => [...new Set((Array.isArray(value) ? value : [value]).map(Number).filter(Number.isInteger))].slice(0, max);
async function accessibleCase(userId, caseId) {
  const { rows } = await pool.query(`SELECT c.id,c.name,c.description,c.location,c.year,c.case_status
    FROM cases c JOIN case_access ca ON ca.case_id=c.id
    WHERE c.id=$1 AND ca.user_id=$2`, [Number(caseId), userId]);
  if (!rows[0]) throw new Error('案例不存在或当前用户无权访问');
  return rows[0];
}
async function accessibleCaseIds(userId, values, min = 1) {
  const wanted = ids(values, 50);
  if (wanted.length < min) throw new Error(`至少需要 ${min} 个案例`);
  const { rows } = await pool.query(`SELECT c.id FROM cases c JOIN case_access ca ON ca.case_id=c.id
    WHERE ca.user_id=$1 AND c.id=ANY($2::int[])`, [userId, wanted]);
  const allowed = new Set(rows.map(r => r.id));
  if (rows.length !== wanted.length) throw new Error('比较集包含当前用户无权访问的案例');
  return wanted.filter(id => allowed.has(id));
}
async function getCurrentCase(userId, input) {
  const c = await accessibleCase(userId, input?.case_id);
  const [entities, relations] = await Promise.all([
    pool.query('SELECT id,name,entity_type,status FROM case_entities WHERE case_id=$1 ORDER BY id', [c.id]),
    pool.query(`SELECT r.id,r.relation_type,r.status,r.source_entity_id,r.target_entity_id,
      s.name AS source_name,t.name AS target_name FROM case_relations r
      LEFT JOIN case_entities s ON s.id=r.source_entity_id LEFT JOIN case_entities t ON t.id=r.target_entity_id
      WHERE r.case_id=$1 ORDER BY r.id`, [c.id]),
  ]);
  return { case: c, entities: entities.rows, relations: relations.rows };
}
async function getSelectedCases(userId, input) {
  const wanted = await accessibleCaseIds(userId, input?.case_ids);
  const { rows } = await pool.query('SELECT id,name,description,location,year,case_status FROM cases WHERE id=ANY($1::int[])', [wanted]);
  return { cases: rows.sort((a,b) => wanted.indexOf(a.id)-wanted.indexOf(b.id)) };
}
async function getEvidence(userId, input) {
  const entityId = Number(input?.entity_id), relationId = Number(input?.relation_id);
  if (!Number.isInteger(entityId) && !Number.isInteger(relationId)) throw new Error('entity_id 或 relation_id 必填');
  const target = Number.isInteger(entityId) ? 'ce.id=$1' : 'cr.id=$1';
  const value = Number.isInteger(entityId) ? entityId : relationId;
  const { rows } = await pool.query(`SELECT e.id,e.quote,e.char_start,e.char_end,e.confidence,e.source,e.status,e.metadata,
      s.id AS segment_id,s.content AS segment_content,s.page,s.segment_index,d.id AS document_id,d.title AS document_title,d.uri
      FROM evidence e LEFT JOIN text_segments s ON e.segment_id=s.id LEFT JOIN documents d ON s.document_id=d.id
      LEFT JOIN case_entities ce ON ce.id=e.entity_id LEFT JOIN case_relations cr ON cr.id=e.relation_id
      JOIN case_access ca ON ca.case_id=COALESCE(ce.case_id,cr.case_id) AND ca.user_id=$2
      WHERE ${target} ORDER BY e.created_at DESC`, [value, userId]);
  return { evidence: rows };
}
async function compareCases(userId, input) {
  const wanted = await accessibleCaseIds(userId, input?.case_ids, 2);
  const [entities, relations] = await Promise.all([
    pool.query('SELECT case_id,id,name,entity_type,status FROM case_entities WHERE case_id=ANY($1::int[]) ORDER BY case_id,id', [wanted]),
    pool.query(`SELECT r.case_id,r.id,r.relation_type,r.status,r.source_entity_id,r.target_entity_id,s.name AS source_name,t.name AS target_name
      FROM case_relations r LEFT JOIN case_entities s ON s.id=r.source_entity_id LEFT JOIN case_entities t ON t.id=r.target_entity_id
      WHERE r.case_id=ANY($1::int[]) ORDER BY r.case_id,r.id`, [wanted]),
  ]);
  return { case_ids: wanted, entities: entities.rows, relations: relations.rows };
}
async function focusNode(userId, input) {
  const entityId = Number(input?.entity_id); if (!Number.isInteger(entityId)) throw new Error('entity_id 必填');
  const { rows } = await pool.query(`SELECT ce.id,ce.case_id,ce.name,ce.entity_type,ce.status,r.id AS relation_id,r.relation_type,r.source_entity_id,r.target_entity_id,s.name AS source_name,t.name AS target_name FROM case_entities ce JOIN case_access ca ON ca.case_id=ce.case_id AND ca.user_id=$2 LEFT JOIN case_relations r ON r.source_entity_id=ce.id OR r.target_entity_id=ce.id LEFT JOIN case_entities s ON s.id=r.source_entity_id LEFT JOIN case_entities t ON t.id=r.target_entity_id WHERE ce.id=$1 ORDER BY r.id`, [entityId, userId]);
  if (!rows[0]) throw new Error('实体不存在或当前用户无权访问');
  const node = { id: rows[0].id, case_id: rows[0].case_id, name: rows[0].name, entity_type: rows[0].entity_type, status: rows[0].status };
  return { node, relations: rows.filter(r => r.relation_id), actions: [{ type: 'focus_node', payload: { nodeId: node.id, caseId: node.case_id } }] };
}
async function comparePaths(userId, input) {
  const wanted = await accessibleCaseIds(userId, input?.case_ids, 2);
  const types = Array.isArray(input?.types) && input.types.length >= 2 ? input.types.slice(0, 8) : [
    'Technology（技术）', 'Capability（技术能力）', 'Task（社区更新任务）',
    'Action / Event（行动与事件）', 'Outcome（结果）'
  ];
  const [entitiesRes, relationsRes, evidenceRes] = await Promise.all([
    pool.query("SELECT id,case_id,name,entity_type,status FROM case_entities WHERE case_id=ANY($1::int[]) AND status<>'rejected'", [wanted]),
    pool.query("SELECT id,case_id,source_entity_id,target_entity_id,relation_type,status FROM case_relations WHERE case_id=ANY($1::int[]) AND status<>'rejected'", [wanted]),
    pool.query(`SELECT ev.relation_id,count(*)::int AS evidence_count,
      json_agg(json_build_object('id',ev.id,'quote',ev.quote,'status',ev.status,'document_title',d.title,'segment_id',ev.segment_id) ORDER BY ev.created_at DESC) AS evidence
      FROM evidence ev JOIN case_relations cr ON cr.id=ev.relation_id
      LEFT JOIN text_segments ts ON ts.id=ev.segment_id LEFT JOIN documents d ON d.id=ts.document_id
      WHERE cr.case_id=ANY($1::int[]) GROUP BY ev.relation_id`, [wanted]),
  ]);
  const byCase = new Map(wanted.map(id => [id, { entities: entitiesRes.rows.filter(e => e.case_id === id), relations: relationsRes.rows.filter(r => r.case_id === id) }]));
  const evidence = new Map(evidenceRes.rows.map(r => [r.relation_id, { count: Number(r.evidence_count), items: r.evidence || [] }]));
  const cases = wanted.map(caseId => {
    const graph = byCase.get(caseId); const paths = [];
    const walk = (nodes, index, edges) => {
      if (index === types.length - 1) { paths.push({ nodes, edges }); return; }
      const tail = nodes[nodes.length - 1];
      graph.relations.filter(r => r.source_entity_id === tail.id).forEach(r => {
        const target = graph.entities.find(e => e.id === r.target_entity_id && e.entity_type === types[index + 1]);
        if (target) walk([...nodes, target], index + 1, [...edges, { ...r, evidence_count: evidence.get(r.id)?.count || 0, evidence: evidence.get(r.id)?.items || [] }]);
      });
    };
    graph.entities.filter(e => e.entity_type === types[0]).forEach(start => walk([start], 0, []));
    return { case_id: caseId, complete: paths.length > 0, paths: paths.slice(0, 50), available_types: [...new Set(graph.entities.map(e => e.entity_type))] };
  });
  return { types, cases, complete_case_ids: cases.filter(c => c.complete).map(c => c.case_id), broken_case_ids: cases.filter(c => !c.complete).map(c => c.case_id), actions: [{ type: 'show_path', payload: { types, cases } }] };
}
const handlers = { get_current_case: getCurrentCase, get_selected_cases: getSelectedCases, get_evidence: getEvidence, compare_cases: compareCases, focus_node: focusNode, compare_paths: comparePaths };
export async function executeCaseflowTool(name, userId, input = {}) {
  if (!handlers[name]) throw new Error(`未知 CaseFlow tool: ${name}`);
  return { tool: name, data: await handlers[name](userId, input) };
}
