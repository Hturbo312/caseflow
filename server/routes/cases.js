import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// ============================================================
// 共享：GraphML XML 构建器（export-all 和单案例 export 共用）
// 共享：CSV 值转义（RFC 4180）
const csvEscape = (val) => {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

// 共享：GraphML XML 构建器（export-all 和单案例 export 共用）
const escapeXml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const GRAPHML_KEYS = [
  '  <key id="name" for="node" attr.name="name" attr.type="string"/>',
  '  <key id="entityType" for="node" attr.name="entityType" attr.type="string"/>',
  '  <key id="caseName" for="node" attr.name="caseName" attr.type="string"/>',
  '  <key id="properties" for="node" attr.name="properties" attr.type="string"/>',
  '  <key id="relationType" for="edge" attr.name="relationType" attr.type="string"/>',
  '  <key id="caseNameEdge" for="edge" attr.name="caseName" attr.type="string"/>',
].join('\n') + '\n';

/**
 * 构建 GraphML XML
 * @param {string} graphId - graph 元素 id
 * @param {Array} nodes - [{ id, name, entityType, caseName, properties }]
 * @param {Array} edges - [{ source, target, relationType, caseName }]
 * @returns {string} GraphML XML 字符串
 */
function buildGraphML(graphId, nodes, edges) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
  xml += GRAPHML_KEYS;
  xml += `  <graph id="${graphId}" edgedefault="directed">\n`;

  const nodeElements = nodes.map(n =>
    `    <node id="${n.id}">\n` +
    `      <data key="name">${escapeXml(n.name)}</data>\n` +
    `      <data key="entityType">${escapeXml(n.entityType)}</data>\n` +
    `      <data key="caseName">${escapeXml(n.caseName)}</data>\n` +
    `      <data key="properties">${escapeXml(n.properties)}</data>\n` +
    `    </node>`
  );

  const edgeElements = edges.map(e =>
    `    <edge source="${e.source}" target="${e.target}">\n` +
    `      <data key="relationType">${escapeXml(e.relationType)}</data>\n` +
    `      <data key="caseNameEdge">${escapeXml(e.caseName)}</data>\n` +
    `    </edge>`
  );

  xml += nodeElements.join('\n') + '\n';
  xml += edgeElements.join('\n') + '\n';
  xml += '  </graph>\n';
  xml += '</graphml>';
  return xml;
}

// 获取所有案例
router.get('/', authMiddleware, async (req, res) => {
  try {
    // 并行查询：案例 + 所有实体 + 所有关系（避免 N+1）
    const [casesResult, entitiesResult, relationsResult] = await Promise.all([
      pool.query('SELECT * FROM cases ORDER BY created_at DESC'),
      pool.query('SELECT * FROM case_entities'),
      pool.query('SELECT * FROM case_relations')
    ]);

    // 按 case_id 分组
    const entitiesByCase = new Map();
    for (const e of entitiesResult.rows) {
      if (!entitiesByCase.has(e.case_id)) entitiesByCase.set(e.case_id, []);
      entitiesByCase.get(e.case_id).push(e);
    }

    const relationsByCase = new Map();
    for (const r of relationsResult.rows) {
      if (!relationsByCase.has(r.case_id)) relationsByCase.set(r.case_id, []);
      relationsByCase.get(r.case_id).push(r);
    }

    const casesWithDetails = casesResult.rows.map(c => ({
      ...c,
      schemaId: c.schema_id?.toString(),
      entities: (entitiesByCase.get(c.id) || []).map(e => ({
        ...e,
        id: e.id?.toString(),
        caseId: e.case_id?.toString(),
        entityType: e.entity_type
      })),
      relations: (relationsByCase.get(c.id) || []).map(r => ({
        ...r,
        id: r.id?.toString(),
        caseId: r.case_id?.toString(),
        sourceId: r.source_entity_id?.toString(),
        targetId: r.target_entity_id?.toString(),
        name: r.relation_type
      }))
    }));

    res.json({ cases: casesWithDetails });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建案例
router.post('/', authMiddleware, async (req, res) => {
  const { name, schemaId, location, year, description, tags } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO cases (name, schema_id, location, year, description, tags) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [name, schemaId, location, year, description, JSON.stringify(tags)]
    );
    res.json({ case: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 图谱数据导出 (必须在 /:id 之前注册)
// ============================================================

// 导出所有案例图谱数据（JSON 列表）
router.get('/export-all', authMiddleware, async (req, res) => {
  try {
    const { format } = req.query;

    // 优化：3 个并行查询代替 N+1（原来每个 case 2 次查询）
    const [casesResult, entitiesResult, relationsResult] = await Promise.all([
      pool.query('SELECT id, name, schema_id FROM cases ORDER BY id'),
      pool.query('SELECT case_id, name, entity_type, properties, color FROM case_entities ORDER BY case_id'),
      pool.query(`SELECT cr.case_id, cr.relation_type,
                         source.name AS source_name, target.name AS target_name
                  FROM case_relations cr
                  JOIN case_entities source ON cr.source_entity_id = source.id
                  JOIN case_entities target ON cr.target_entity_id = target.id
                  ORDER BY cr.case_id`),
    ]);

    // 按 case_id 分组实体
    const entitiesByCase = new Map();
    for (const e of entitiesResult.rows) {
      if (!entitiesByCase.has(e.case_id)) entitiesByCase.set(e.case_id, []);
      entitiesByCase.get(e.case_id).push(e);
    }

    // 按 case_id 分组关系
    const relationsByCase = new Map();
    for (const r of relationsResult.rows) {
      if (!relationsByCase.has(r.case_id)) relationsByCase.set(r.case_id, []);
      relationsByCase.get(r.case_id).push(r);
    }

    const allExports = casesResult.rows.map(c => {
      const ents = entitiesByCase.get(c.id) || [];
      const rels = relationsByCase.get(c.id) || [];
      return {
        case_id: c.id,
        case_name: c.name,
        schema_id: c.schema_id,
        entities: ents.map(e => ({
          name: e.name,
          entityType: e.entity_type,
          properties: typeof e.properties === 'string' ? JSON.parse(e.properties) : e.properties,
          color: e.color,
        })),
        relations: rels.map(r => ({
          type: r.relation_type,
          source: r.source_name,
          target: r.target_name,
        })),
        summary: {
          entity_count: ents.length,
          relation_count: rels.length,
        },
      };
    });

    if (format === 'csv') {
      const entityRows = [];
      const relationRows = [];
      for (const exp of allExports) {
        for (const e of exp.entities) {
          entityRows.push([exp.case_id, exp.case_name, e.name, e.entityType, e.color || '', csvEscape(JSON.stringify(e.properties || {}))].map(csvEscape).join(','));
        }
        for (const r of exp.relations) {
          relationRows.push([exp.case_id, exp.case_name, r.type, r.source, r.target].map(csvEscape).join(','));
        }
      }
      return res.json({
        format: 'csv',
        entities_csv: 'case_id,case_name,name,entityType,color,properties\n' + entityRows.join('\n'),
        relations_csv: 'case_id,case_name,type,source,target\n' + relationRows.join('\n'),
        total_cases: allExports.length,
      });
    }

    if (format === 'graphml') {
      // 构建 GraphML 数据（export-all 多案例模式：需要映射 entity name → node id）
      let nodeId = 0;
      const nameToNodeId = new Map();
      const nodes = [];
      const edges = [];

      for (const exp of allExports) {
        const entityNameToType = new Map();
        for (const e of exp.entities) {
          entityNameToType.set(e.name, e.entityType);
        }
        for (const e of exp.entities) {
          const id = `n${nodeId++}`;
          const key = `${e.name}::${e.entityType}::${exp.case_id}`;
          nameToNodeId.set(key, id);
          nodes.push({
            id,
            name: e.name,
            entityType: e.entityType,
            caseName: exp.case_name,
            properties: JSON.stringify(e.properties || {}),
          });
        }
        for (const r of exp.relations) {
          const sourceType = entityNameToType.get(r.source);
          const targetType = entityNameToType.get(r.target);
          const sourceKey = `${r.source}::${sourceType}::${exp.case_id}`;
          const targetKey = `${r.target}::${targetType}::${exp.case_id}`;
          const srcId = nameToNodeId.get(sourceKey);
          const tgtId = nameToNodeId.get(targetKey);
          if (srcId && tgtId) {
            edges.push({
              source: srcId,
              target: tgtId,
              relationType: r.type,
              caseName: exp.case_name,
            });
          }
        }
      }

      const graphml = buildGraphML('caseflow-export', nodes, edges);

      return res.json({
        format: 'graphml',
        graphml,
        total_nodes: nodeId,
        total_edges: edges.length,
        total_cases: allExports.length,
      });
    }

    res.json({
      format: 'json',
      total_cases: allExports.length,
      cases: allExports,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取案例详情（优化：3 个查询并行执行，减少等待时间）
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const [caseResult, entitiesResult, relationsResult] = await Promise.all([
      pool.query('SELECT * FROM cases WHERE id = $1', [id]),
      pool.query('SELECT * FROM case_entities WHERE case_id = $1', [id]),
      pool.query('SELECT * FROM case_relations WHERE case_id = $1', [id])
    ]);

    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: '案例不存在' });
    }

    res.json({
      case: caseResult.rows[0],
      entities: entitiesResult.rows,
      relations: relationsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加案例实体
router.post('/:caseId/entities', authMiddleware, async (req, res) => {
  const { caseId } = req.params;
  const { name, entityType, properties } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO case_entities (case_id, name, entity_type, properties) VALUES ($1, $2, $3, $4) RETURNING *',
      [caseId, name, entityType, JSON.stringify(properties)]
    );
    res.json({ entity: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加案例关系
router.post('/:caseId/relations', authMiddleware, async (req, res) => {
  const { caseId } = req.params;
  const { sourceEntityId, targetEntityId, relationType } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO case_relations (case_id, source_entity_id, target_entity_id, relation_type) VALUES ($1, $2, $3, $4) RETURNING *',
      [caseId, sourceEntityId, targetEntityId, relationType]
    );
    res.json({ relation: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除案例实体
router.delete('/:caseId/entities/:entityId', authMiddleware, async (req, res) => {
  const { caseId, entityId } = req.params;
  try {
    await pool.query(
      'DELETE FROM case_relations WHERE case_id = $1 AND (source_entity_id = $2 OR target_entity_id = $2)',
      [caseId, entityId]
    );
    await pool.query('DELETE FROM case_entities WHERE id = $1 AND case_id = $2', [entityId, caseId]);
    res.json({ message: 'Entity deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除案例关系
router.delete('/:caseId/relations/:relationId', authMiddleware, async (req, res) => {
  const { caseId, relationId } = req.params;
  try {
    await pool.query('DELETE FROM case_relations WHERE id = $1 AND case_id = $2', [relationId, caseId]);
    res.json({ message: 'Relation deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除案例
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM cases WHERE id = $1', [id]);
    res.json({ message: 'Case deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 图谱数据导出
// ============================================================

// 导出案例图谱数据（JSON）
router.get('/:id/export', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { format } = req.query; // 'json' | 'csv'

    const caseResult = await pool.query('SELECT * FROM cases WHERE id = $1', [id]);
    if (caseResult.rows.length === 0) {
      return res.status(404).json({ error: '案例不存在' });
    }
    const caseData = caseResult.rows[0];

    const entitiesResult = await pool.query(
      'SELECT id, name, entity_type, properties, color, created_at FROM case_entities WHERE case_id = $1 ORDER BY entity_type, name',
      [id]
    );
    const relationsResult = await pool.query(
      `SELECT cr.id, cr.relation_type, cr.source_entity_id, cr.target_entity_id,
              source.name AS source_name, source.entity_type AS source_type,
              target.name AS target_name, target.entity_type AS target_type,
              cr.created_at
       FROM case_relations cr
       JOIN case_entities source ON cr.source_entity_id = source.id
       JOIN case_entities target ON cr.target_entity_id = target.id
       WHERE cr.case_id = $1
       ORDER BY cr.relation_type`,
      [id]
    );

    const exportData = {
      case: {
        id: caseData.id,
        name: caseData.name,
        description: caseData.description,
        schema_id: caseData.schema_id,
        location: caseData.location,
        year: caseData.year,
        tags: caseData.tags,
        created_at: caseData.created_at,
        updated_at: caseData.updated_at,
      },
      entities: entitiesResult.rows.map(e => ({
        id: e.id,
        name: e.name,
        entityType: e.entity_type,
        properties: typeof e.properties === 'string' ? JSON.parse(e.properties) : e.properties,
        color: e.color,
        created_at: e.created_at,
      })),
      relations: relationsResult.rows.map(r => ({
        id: r.id,
        type: r.relation_type,
        source: { name: r.source_name, type: r.source_type },
        target: { name: r.target_name, type: r.target_type },
        created_at: r.created_at,
      })),
      summary: {
        entity_count: entitiesResult.rows.length,
        relation_count: relationsResult.rows.length,
        entity_types: [...new Set(entitiesResult.rows.map(e => e.entity_type))],
        relation_types: [...new Set(relationsResult.rows.map(r => r.relation_type))],
      },
    };

    if (format === 'csv') {
      const entityCsv = 'id,name,entityType,color,properties,created_at\n' +
        entitiesResult.rows.map(e => {
          const props = typeof e.properties === 'string' ? e.properties : JSON.stringify(e.properties || {});
          return [csvEscape(e.id), csvEscape(e.name), csvEscape(e.entity_type), csvEscape(e.color || ''), csvEscape(props), csvEscape(e.created_at)].join(',');
        }).join('\n');

      const relationCsv = 'id,type,sourceName,sourceType,targetName,targetType,created_at\n' +
        relationsResult.rows.map(r => {
          return [csvEscape(r.id), csvEscape(r.relation_type), csvEscape(r.source_name), csvEscape(r.source_type), csvEscape(r.target_name), csvEscape(r.target_type), csvEscape(r.created_at)].join(',');
        }).join('\n');

      return res.json({
        format: 'csv',
        case_name: caseData.name,
        entities_csv: entityCsv,
        relations_csv: relationCsv,
        summary: exportData.summary,
      });
    }

    if (format === 'graphml') {
      // 构建 GraphML 数据（单案例模式：直接使用 DB entity ID 作为 node id）
      const nodes = entitiesResult.rows.map(e => ({
        id: String(e.id),
        name: e.name,
        entityType: e.entity_type,
        caseName: caseData.name,
        properties: typeof e.properties === 'string' ? e.properties : JSON.stringify(e.properties || {}),
      }));

      const edges = relationsResult.rows
        .filter(r => r.source_entity_id && r.target_entity_id)
        .map(r => ({
          source: String(r.source_entity_id),
          target: String(r.target_entity_id),
          relationType: r.relation_type,
          caseName: caseData.name,
        }));

      const graphml = buildGraphML('caseflow-case', nodes, edges);

      return res.json({
        format: 'graphml',
        graphml,
        case_name: caseData.name,
        total_nodes: nodes.length,
        total_edges: edges.length,
        summary: exportData.summary,
      });
    }

    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;