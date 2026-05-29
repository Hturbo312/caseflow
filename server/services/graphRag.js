import pool from '../db.js';
import { PORT, aiConfigCache } from '../config.js';

/**
 * GraphRAG 核心服务：混合检索（向量 + 全文 + 图扩展）
 */

// AGE 查询辅助函数 — 用字符串拼接而非参数化（AGE cypher 不支持 $1/$2）
async function ageQuery(graphName, cypher, columns = ['v agtype']) {
  await pool.query(`LOAD 'age'`);
  await pool.query('SET search_path = ag_catalog, public');
  const colList = columns.join(', ');
  // 转义 graphName 防止 SQL 注入
  const safeGraphName = graphName.replace(/[^a-zA-Z0-9_]/g, '');
  const result = await pool.query(
    `SELECT * FROM cypher('${safeGraphName}', '${cypher.replace(/'/g, "''")}') AS (${colList})`
  );
  return result.rows;
}

// 将 agtype 值解析为 JSON
function parseAgtype(value) {
  if (typeof value === 'string') {
    // Cypher 返回的字符串包含 ::vertex/::edge/::path 等 AGE 类型后缀，需要去掉
    const cleaned = value.replace(/::\w+/g, '');
    try { return JSON.parse(cleaned); } catch { return value; }
  }
  return value;
}

// 通过本地 API 生成 embedding
async function embedText(text) {
  const response = await fetch(`http://localhost:${PORT}/api/ai/embedding`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts: [text] }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.data?.[0]?.embedding;
}

// 向量检索实体
async function vectorSearchEntities(queryVector, { schemaId, caseId, threshold = 0.3, limit = 20 }) {
  let sql = `
    SELECT e.id, e.name, e.entity_type, e.properties, e.case_id,
           c.name AS case_name, c.schema_id,
           1 - (e.embedding <=> $1::vector) AS similarity
    FROM case_entities e
    JOIN cases c ON e.case_id = c.id
    WHERE e.embedding IS NOT NULL AND 1 - (e.embedding <=> $1::vector) > $2
  `;
  const params = [`[${queryVector.join(',')}]`, threshold];
  let idx = 3;

  if (schemaId) {
    sql += ` AND c.schema_id = $${idx}`;
    params.push(schemaId);
    idx++;
  }
  if (caseId) {
    sql += ` AND e.case_id = $${idx}`;
    params.push(caseId);
    idx++;
  }
  sql += ` ORDER BY similarity DESC LIMIT $${idx}`;
  params.push(limit);

  const result = await pool.query(sql, params);
  return result.rows.map(r => ({
    id: r.id,
    name: r.name,
    entityType: r.entity_type,
    properties: r.properties,
    caseId: r.case_id,
    caseName: r.case_name,
    schemaId: r.schema_id,
    similarity: parseFloat(r.similarity.toFixed(4)),
  }));
}

// 全文检索实体
async function fullTextSearchEntities(query, { schemaId, caseId, limit = 20 }) {
  const keywords = query.trim().split(/\s+/).filter(Boolean);
  if (keywords.length === 0) return [];

  const searchQuery = keywords.join(' & ');
  let sql = `
    SELECT e.id, e.name, e.entity_type, e.properties, e.case_id,
           c.name AS case_name, c.schema_id,
           ts_rank(to_tsvector('simple', e.name), plainto_tsquery('simple', $1)) AS rank
    FROM case_entities e
    JOIN cases c ON e.case_id = c.id
    WHERE to_tsvector('simple', e.name) @@ plainto_tsquery('simple', $1)
  `;
  const params = [searchQuery];
  let idx = 2;

  if (schemaId) {
    sql += ` AND c.schema_id = $${idx}`;
    params.push(schemaId);
    idx++;
  }
  if (caseId) {
    sql += ` AND e.case_id = $${idx}`;
    params.push(caseId);
    idx++;
  }
  sql += ` ORDER BY rank DESC LIMIT $${idx}`;
  params.push(limit);

  const result = await pool.query(sql, params);
  return result.rows.map(r => ({
    id: r.id,
    name: r.name,
    entityType: r.entity_type,
    properties: r.properties,
    caseId: r.case_id,
    caseName: r.case_name,
    schemaId: r.schema_id,
    rank: parseFloat(r.rank.toFixed(4)),
  }));
}

// 向量检索案例
async function vectorSearchCases(queryVector, { schemaId, threshold = 0.3, limit = 10 }) {
  let sql = `
    SELECT id, name, description, schema_id,
           1 - (embedding <=> $1::vector) AS similarity
    FROM cases
    WHERE embedding IS NOT NULL AND 1 - (embedding <=> $1::vector) > $2
  `;
  const params = [`[${queryVector.join(',')}]`, threshold];
  let idx = 3;

  if (schemaId) {
    sql += ` AND schema_id = $${idx}`;
    params.push(schemaId);
    idx++;
  }
  sql += ` ORDER BY similarity DESC LIMIT $${idx}`;
  params.push(limit);

  const result = await pool.query(sql, params);
  return result.rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    schemaId: r.schema_id,
    similarity: parseFloat(r.similarity.toFixed(4)),
  }));
}

// RRF 融合排序
function rrfRank(lists, k = 60) {
  const scores = new Map();
  for (const list of lists) {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const key = item.id;
      const rrfScore = 1 / (k + i + 1);
      if (scores.has(key)) {
        const existing = scores.get(key);
        existing.score += rrfScore;
        // 合并属性
        Object.assign(existing, item);
      } else {
        scores.set(key, { ...item, score: rrfScore });
      }
    }
  }
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score);
}

// 图扩展：从种子实体做 k-hop 遍历
async function graphExpand(entityIds, graphName, depth = 1) {
  if (entityIds.length === 0) return { nodes: [], edges: [] };

  const idList = entityIds.join(', ');
  const safeGraphName = graphName.replace(/[^a-zA-Z0-9_]/g, '');

  await pool.query(`LOAD 'age'`);
  await pool.query('SET search_path = ag_catalog, public');

  const cypherPart = `MATCH path = (e)-[r*1..${depth}]-(neighbor) WHERE e.db_id IN [${idList}] RETURN path`;
  const result = await pool.query(
    `SELECT * FROM cypher('${safeGraphName}', $$${cypherPart}$$) AS (v agtype)`
  );

  const nodeMap = new Map();
  const edgeSet = new Set();
  const edges = [];

  for (const row of result.rows) {
    const path = parseAgtype(row.v);
    if (!path) continue;

    // path 是 [vertex, edge, vertex, edge, ...] 数组
    if (!Array.isArray(path)) continue;

    for (let i = 0; i < path.length; i += 2) {
      const vertex = path[i];
      if (vertex && typeof vertex === 'object' && vertex.properties) {
        const props = vertex.properties;
        const nodeId = props.db_id || vertex.id;
        if (!nodeMap.has(nodeId)) {
          nodeMap.set(nodeId, {
            id: nodeId,
            name: props.name || '',
            entityType: props.entity_type || '',
            caseId: props.case_id,
            caseName: props.case_name,
            properties: props.properties || {},
          });
        }
      }

      if (i + 1 < path.length) {
        const edge = path[i + 1];
        if (edge && typeof edge === 'object' && edge.properties) {
          // 用 path 中相邻顶点的 db_id 作为边的 source/target
          const srcVertex = path[i];
          const tgtVertex = path[i + 2];
          const srcDbId = srcVertex && srcVertex.properties ? srcVertex.properties.db_id : null;
          const tgtDbId = tgtVertex && tgtVertex.properties ? tgtVertex.properties.db_id : null;
          const edgeKey = `${srcDbId}-${tgtDbId}-${edge.properties.relation_type}`;
          if (!edgeSet.has(edgeKey)) {
            edgeSet.add(edgeKey);
            edges.push({
              sourceId: srcDbId,
              targetId: tgtDbId,
              relationType: edge.properties.relation_type || '',
            });
          }
        }
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

// === 导出函数 ===

/**
 * GraphRAG 混合检索
 * 向量 + 全文 + 图扩展
 */
export async function graphRagSearch(query, options = {}) {
  const { schemaId, caseId, limit = 15, threshold = 0.3, depth = 1 } = options;

  // 1. 向量化查询
  const queryVector = await embedText(query);

  // 2. 三路召回
  const [vectorEntities, ftEntities, vectorCases] = await Promise.all([
    vectorSearchEntities(queryVector, { schemaId, caseId, threshold, limit }),
    fullTextSearchEntities(query, { schemaId, caseId, limit }),
    vectorSearchCases(queryVector, { schemaId, threshold, limit: 5 }),
  ]);

  // 3. RRF 融合实体排序
  const mergedEntities = rrfRank([vectorEntities, ftEntities]);

  // 4. 图扩展：从 top 匹配实体出发
  const topEntityIds = mergedEntities.slice(0, 10).map(e => e.id);
  const graphName = `schema_${schemaId || 3}`;

  let subgraph = { nodes: [], edges: [] };
  try {
    subgraph = await graphExpand(topEntityIds, graphName, depth);
  } catch (err) {
    console.warn('图扩展失败:', err.message);
  }

  // 5. 获取相关关系（基于匹配实体）
  const matchedEntityIds = mergedEntities.slice(0, 15).map(e => e.id);
  let relations = [];
  if (matchedEntityIds.length > 0) {
    const relResult = await pool.query(
      `SELECT cr.id, cr.relation_type,
              s.name AS source_name, t.name AS target_name,
              s.id AS source_id, t.id AS target_id
       FROM case_relations cr
       JOIN case_entities s ON cr.source_entity_id = s.id
       JOIN case_entities t ON cr.target_entity_id = t.id
       WHERE cr.source_entity_id = ANY($1) OR cr.target_entity_id = ANY($1)`,
      [matchedEntityIds]
    );
    relations = relResult.rows.map(r => ({
      id: r.id,
      relationType: r.relation_type,
      sourceName: r.source_name,
      targetName: r.target_name,
      sourceId: r.source_id,
      targetId: r.target_id,
    }));
  }

  return {
    query,
    entities: mergedEntities.slice(0, limit),
    cases: vectorCases,
    relations,
    subgraph,
  };
}

/**
 * 获取关联案例推荐
 * 三路融合: 图遍历(共享概念邻居) + 案例向量相似度 + 实体类型分布相似度
 *
 * 图遍历策略:
 *   案例0是"跨案例概念层"，所有其他案例的实体都通过关系连接到案例0的抽象概念实体。
 *   两个案例越相似，它们的实体连接的案例0实体就越重叠。
 *   用 AGE 从两个案例的实体分别做 1-hop 遍历，取案例0实体集合的 Jaccard 相似度。
 */
export async function getRelatedCases(caseId, options = {}) {
  const { limit = 10, schemaId } = options;

  // 获取目标案例信息
  const caseResult = await pool.query('SELECT schema_id, name, embedding FROM cases WHERE id = $1', [caseId]);
  const targetCase = caseResult.rows[0];
  if (!targetCase) return { caseId, recommendations: [] };

  const filterSchema = schemaId || targetCase.schema_id;
  const graphName = `schema_${targetCase.schema_id || 3}`;

  // 获取目标案例的实体类型分布
  const typeDistResult = await pool.query(
    'SELECT entity_type, COUNT(*) AS cnt FROM case_entities WHERE case_id = $1 GROUP BY entity_type',
    [caseId]
  );
  const targetTypeDist = new Map();
  let totalEntities = 0;
  for (const row of typeDistResult.rows) {
    targetTypeDist.set(row.entity_type, parseInt(row.cnt));
    totalEntities += parseInt(row.cnt);
  }

  // === 图遍历: 获取目标案例实体连接的案例0概念实体 ===
  const targetConceptNeighbors = await getCaseConceptNeighbors(caseId, graphName);
  const targetConceptSet = new Set(targetConceptNeighbors);

  // 获取其他案例
  let sql = `
    SELECT c.id, c.name, c.description, c.schema_id, c.embedding
    FROM cases c
    WHERE c.id != $1 AND c.id != 0
  `;
  const params = [caseId];
  let idx = 2;
  if (filterSchema) {
    sql += ` AND c.schema_id = $${idx}`;
    params.push(filterSchema);
    idx++;
  }
  sql += ` ORDER BY c.id`;

  const otherCasesResult = await pool.query(sql, params);
  const otherCases = otherCasesResult.rows;
  const targetEmb = targetCase.embedding ? parseVector(targetCase.embedding) : null;

  // 优化：批量查询所有其他案例的实体类型分布，避免 N+1 查询
  const otherCaseIds = otherCases.map(c => c.id);
  let otherTypeDistResult = { rows: [] };
  if (otherCaseIds.length > 0) {
    otherTypeDistResult = await pool.query(
      'SELECT case_id, entity_type, COUNT(*) AS cnt FROM case_entities WHERE case_id = ANY($1) GROUP BY case_id, entity_type',
      [otherCaseIds]
    );
  }
  // 按 case_id 分组
  const typeDistByCase = new Map();
  for (const row of otherTypeDistResult.rows) {
    if (!typeDistByCase.has(row.case_id)) typeDistByCase.set(row.case_id, new Map());
    typeDistByCase.get(row.case_id).set(row.entity_type, parseInt(row.cnt));
  }

  const recommendations = [];
  for (const oc of otherCases) {
    // 1. 图遍历分: 共享案例0概念邻居的 Jaccard 相似度
    let graphScore = 0;
    let sharedConcepts = [];
    if (targetConceptSet.size > 0) {
      const otherConceptNeighbors = await getCaseConceptNeighbors(oc.id, graphName);
      const otherConceptSet = new Set(otherConceptNeighbors);
      const intersection = [...targetConceptSet].filter(c => otherConceptSet.has(c));
      const union = new Set([...targetConceptSet, ...otherConceptSet]);
      if (union.size > 0) {
        graphScore = intersection.length / union.size;
      }
      // 获取共享概念实体的名称
      if (intersection.length > 0) {
        const conceptResult = await pool.query(
          'SELECT name, entity_type FROM case_entities WHERE case_id = 0 AND id = ANY($1) LIMIT 5',
          [intersection]
        );
        sharedConcepts = conceptResult.rows.map(r => ({ name: r.name, type: r.entity_type }));
      }
    }

    // 2. 案例向量相似度
    let caseSimScore = 0;
    if (targetEmb && oc.embedding) {
      const otherEmb = parseVector(oc.embedding);
      caseSimScore = cosineSimilarity(targetEmb, otherEmb);
    }

    // 3. 实体类型分布相似度（使用预查询结果，避免 N+1）
    const otherTypeDist = typeDistByCase.get(oc.id) || new Map();

    let typeSimScore = 0;
    const allTypes = new Set([...targetTypeDist.keys(), ...otherTypeDist.keys()]);
    if (allTypes.size > 0) {
      let dot = 0, magA = 0, magB = 0;
      for (const t of allTypes) {
        const a = targetTypeDist.get(t) || 0;
        const b = otherTypeDist.get(t) || 0;
        dot += a * b;
        magA += a * a;
        magB += b * b;
      }
      typeSimScore = (magA > 0 && magB > 0) ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
    }

    const sharedTypes = [...targetTypeDist.keys()].filter(t => otherTypeDist.has(t));

    // 综合评分: 图遍历(0.5) + 向量(0.3) + 类型(0.2)
    const score = graphScore * 0.5 + caseSimScore * 0.3 + typeSimScore * 0.2;

    const reasons = [];
    if (graphScore > 0) reasons.push(`图结构相似度 ${graphScore.toFixed(2)}（${sharedConcepts.length} 个共享概念）`);
    if (caseSimScore > 0) reasons.push(`案例向量相似度 ${caseSimScore.toFixed(2)}`);
    if (typeSimScore > 0.5) reasons.push(`实体类型分布相似度 ${typeSimScore.toFixed(2)}`);
    if (sharedConcepts.length > 0) {
      const sampleConcepts = sharedConcepts.slice(0, 3).map(c => c.name);
      reasons.push(`共享概念: ${sampleConcepts.join('、')}`);
    }

    recommendations.push({
      id: oc.id,
      name: oc.name,
      schemaId: oc.schema_id,
      description: oc.description,
      score: parseFloat(score.toFixed(4)),
      graphSimilarity: parseFloat(graphScore.toFixed(4)),
      caseSimilarity: parseFloat(caseSimScore.toFixed(4)),
      typeSimilarity: parseFloat(typeSimScore.toFixed(4)),
      sharedConcepts,
      sharedTypes,
      reasons,
    });
  }

  return {
    caseId,
    recommendations: recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, limit),
  };
}

/**
 * 获取某个案例的实体通过图遍历到达的案例0实体ID列表
 * 使用 AGE 的 1-hop 遍历
 */
async function getCaseConceptNeighbors(caseId, graphName) {
  const entityIdsResult = await pool.query(
    'SELECT id FROM case_entities WHERE case_id = $1',
    [caseId]
  );
  if (entityIdsResult.rows.length === 0) return [];

  const idList = entityIdsResult.rows.map(r => r.id).join(', ');
  const safeGraphName = graphName.replace(/[^a-zA-Z0-9_]/g, '');

  try {
    await pool.query(`LOAD 'age'`);
    await pool.query('SET search_path = ag_catalog, public');

    const cypherPart = `MATCH (a:Entity)-[r:RelatesTo]-(b:Entity) WHERE a.db_id IN [${idList}] RETURN a, r, b`;
    const sql = `SELECT DISTINCT (replace(ag_catalog.agtype_out(b)::text, '::vertex', '')::jsonb->'properties'->>'case_id')::int AS case_id,
         (replace(ag_catalog.agtype_out(b)::text, '::vertex', '')::jsonb->'properties'->>'db_id')::bigint AS neighbor_id
       FROM cypher('${safeGraphName}', $$${cypherPart}$$) AS (a agtype, r agtype, b agtype)
       WHERE (replace(ag_catalog.agtype_out(b)::text, '::vertex', '')::jsonb->'properties'->>'case_id')::int = 0`;

    const result = await pool.query(sql);
    return result.rows.map(r => r.neighbor_id).filter(id => id != null);
  } catch (err) {
    console.warn(`getCaseConceptNeighbors(${caseId}) AGE 失败，回退到关系表查询:`, err.message);
    const fallbackResult = await pool.query(
      `SELECT DISTINCT cr.source_entity_id AS eid
       FROM case_relations cr
       WHERE cr.source_entity_id = ANY($1)
         AND EXISTS (SELECT 1 FROM case_entities ce WHERE ce.id = cr.source_entity_id AND ce.case_id = 0)
       UNION
       SELECT DISTINCT cr.target_entity_id AS eid
       FROM case_relations cr
       WHERE cr.target_entity_id = ANY($1)
         AND EXISTS (SELECT 1 FROM case_entities ce WHERE ce.id = cr.target_entity_id AND ce.case_id = 0)`,
      [entityIdsResult.rows.map(r => r.id)]
    );
    return fallbackResult.rows.map(r => r.eid);
  }
}

// 解析 pgvector 格式为数组
function parseVector(emb) {
  if (Array.isArray(emb)) return emb;
  if (typeof emb === 'string') {
    // "[0.1, 0.2, ...]" 格式
    return JSON.parse(emb);
  }
  return null;
}

// 余弦相似度
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  return (magA > 0 && magB > 0) ? dot / (Math.sqrt(magA) * Math.sqrt(magB)) : 0;
}

/**
 * 子图提取
 */
export async function extractSubgraph(entityIds, options = {}) {
  const { depth = 1, schemaId = 3 } = options;
  const graphName = `schema_${schemaId}`;

  const dbIds = await pool.query(
    'SELECT id FROM case_entities WHERE id = ANY($1)',
    [entityIds]
  );
  const validIds = dbIds.rows.map(r => r.id);

  if (validIds.length === 0) return { nodes: [], edges: [] };

  try {
    return await graphExpand(validIds, graphName, depth);
  } catch (err) {
    console.warn('子图提取失败:', err.message);
    // 回退：使用关系表查询
    const relResult = await pool.query(
      `SELECT cr.id, cr.relation_type, cr.source_entity_id, cr.target_entity_id,
              s.name AS source_name, s.entity_type AS source_type, s.properties AS source_props,
              t.name AS target_name, t.entity_type AS target_type, t.properties AS target_props
       FROM case_relations cr
       JOIN case_entities s ON cr.source_entity_id = s.id
       JOIN case_entities t ON cr.target_entity_id = t.id
       WHERE cr.source_entity_id = ANY($1) OR cr.target_entity_id = ANY($1)`,
      [validIds]
    );

    const nodeMap = new Map();
    const edges = [];
    for (const row of relResult.rows) {
      if (!nodeMap.has(row.source_entity_id)) {
        nodeMap.set(row.source_entity_id, {
          id: row.source_entity_id,
          name: row.source_name,
          entityType: row.source_type,
          properties: row.source_props || {},
        });
      }
      if (!nodeMap.has(row.target_entity_id)) {
        nodeMap.set(row.target_entity_id, {
          id: row.target_entity_id,
          name: row.target_name,
          entityType: row.target_type,
          properties: row.target_props || {},
        });
      }
      edges.push({
        sourceId: row.source_entity_id,
        targetId: row.target_entity_id,
        relationType: row.relation_type,
      });
    }
    return { nodes: Array.from(nodeMap.values()), edges };
  }
}

/**
 * 构建 GraphRAG 上下文字符串（用于 LLM prompt）
 */
export async function buildGraphRAGContext(question, schemaId, caseId) {
  const searchResult = await graphRagSearch(question, {
    schemaId,
    caseId,
    limit: 15,
    depth: 2,
  });

  const parts = [];

  // 实体
  if (searchResult.entities.length > 0) {
    parts.push('## 检索到的实体');
    for (const e of searchResult.entities.slice(0, 10)) {
      const props = e.properties || {};
      const propStr = Object.entries(props)
        .slice(0, 5)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ');
      parts.push(`- ${e.name} (${e.entityType})${propStr ? ` — ${propStr}` : ''}`);
      if (e.caseName) parts.push(`  来源案例: ${e.caseName}`);
    }
  }

  // 关系
  if (searchResult.relations.length > 0) {
    parts.push('\n## 图谱关系');
    for (const r of searchResult.relations.slice(0, 15)) {
      parts.push(`- [${r.sourceName}] --(${r.relationType})--> [${r.targetName}]`);
    }
  }

  // 相关案例
  if (searchResult.cases.length > 0) {
    parts.push('\n## 相关案例');
    for (const c of searchResult.cases) {
      const desc = c.description ? c.description.slice(0, 150) : '';
      parts.push(`- ${c.name}${desc ? `: ${desc}...` : ''}`);
    }
  }

  // 子图信息
  if (searchResult.subgraph.nodes.length > 0) {
    parts.push(`\n## 子图扩展`);
    parts.push(`发现 ${searchResult.subgraph.nodes.length} 个关联节点，${searchResult.subgraph.edges.length} 条关系边`);
  }

  return parts.join('\n') || '未找到相关信息';
}
