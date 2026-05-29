import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

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
    const casesResult = await pool.query('SELECT id, name, schema_id FROM cases ORDER BY id');

    const allExports = [];
    for (const c of casesResult.rows) {
      const entitiesResult = await pool.query(
        'SELECT id, name, entity_type, properties FROM case_entities WHERE case_id = $1',
        [c.id]
      );
      const relationsResult = await pool.query(
        `SELECT cr.id, cr.relation_type,
                source.name AS source_name, target.name AS target_name
         FROM case_relations cr
         JOIN case_entities source ON cr.source_entity_id = source.id
         JOIN case_entities target ON cr.target_entity_id = target.id
         WHERE cr.case_id = $1`,
        [c.id]
      );

      allExports.push({
        case_id: c.id,
        case_name: c.name,
        schema_id: c.schema_id,
        entities: entitiesResult.rows.map(e => ({
          name: e.name,
          entityType: e.entity_type,
          properties: typeof e.properties === 'string' ? JSON.parse(e.properties) : e.properties,
        })),
        relations: relationsResult.rows.map(r => ({
          type: r.relation_type,
          source: r.source_name,
          target: r.target_name,
        })),
        summary: {
          entity_count: entitiesResult.rows.length,
          relation_count: relationsResult.rows.length,
        },
      });
    }

    if (format === 'csv') {
      // CSV 安全转义：处理引号和逗号
      const csvEscape = (val) => {
        const str = String(val ?? '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const entityRows = [];
      const relationRows = [];
      for (const exp of allExports) {
        for (const e of exp.entities) {
          entityRows.push([exp.case_id, exp.case_name, e.name, e.entityType, csvEscape(JSON.stringify(e.properties || {}))].map(csvEscape).join(','));
        }
        for (const r of exp.relations) {
          relationRows.push([exp.case_id, exp.case_name, r.type, r.source, r.target].map(csvEscape).join(','));
        }
      }
      return res.json({
        format: 'csv',
        entities_csv: 'case_id,case_name,name,entityType,properties\n' + entityRows.join('\n'),
        relations_csv: 'case_id,case_name,type,source,target\n' + relationRows.join('\n'),
        total_cases: allExports.length,
      });
    }

    if (format === 'graphml') {
      // GraphML 格式（Gephi / Cytoscape 兼容）
      const escapeXml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      let graphml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      graphml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
      graphml += '  <key id="name" for="node" attr.name="name" attr.type="string"/>\n';
      graphml += '  <key id="entityType" for="node" attr.name="entityType" attr.type="string"/>\n';
      graphml += '  <key id="caseName" for="node" attr.name="caseName" attr.type="string"/>\n';
      graphml += '  <key id="properties" for="node" attr.name="properties" attr.type="string"/>\n';
      graphml += '  <key id="relationType" for="edge" attr.name="relationType" attr.type="string"/>\n';
      graphml += '  <key id="caseNameEdge" for="edge" attr.name="caseName" attr.type="string"/>\n';
      graphml += '  <graph id="caseflow-export" edgedefault="directed">\n';

      let nodeId = 0;
      const nameToNodeId = new Map();
      const nodeElements = [];
      const edgeElements = [];

      for (const exp of allExports) {
        for (const e of exp.entities) {
          const id = `n${nodeId++}`;
          const key = `${e.name}::${e.entityType}::${exp.case_id}`;
          nameToNodeId.set(key, id);
          const props = JSON.stringify(e.properties || {});
          nodeElements.push(
            `    <node id="${id}">\n` +
            `      <data key="name">${escapeXml(e.name)}</data>\n` +
            `      <data key="entityType">${escapeXml(e.entityType)}</data>\n` +
            `      <data key="caseName">${escapeXml(exp.case_name)}</data>\n` +
            `      <data key="properties">${escapeXml(props)}</data>\n` +
            `    </node>`
          );
        }
        for (const r of exp.relations) {
          const sourceKey = `${r.source}::${exp.case_name}::${exp.case_id}`;
          const targetKey = `${r.target}::${exp.case_name}::${exp.case_id}`;
          const srcId = nameToNodeId.get(sourceKey);
          const tgtId = nameToNodeId.get(targetKey);
          if (srcId && tgtId) {
            edgeElements.push(
              `    <edge source="${srcId}" target="${tgtId}">\n` +
              `      <data key="relationType">${escapeXml(r.type)}</data>\n` +
              `      <data key="caseNameEdge">${escapeXml(exp.case_name)}</data>\n` +
              `    </edge>`
            );
          }
        }
      }

      graphml += nodeElements.join('\n') + '\n';
      graphml += edgeElements.join('\n') + '\n';
      graphml += '  </graph>\n';
      graphml += '</graphml>';

      return res.json({
        format: 'graphml',
        graphml,
        total_nodes: nodeId,
        total_edges: edgeElements.length,
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

// 获取案例详情
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const caseResult = await pool.query('SELECT * FROM cases WHERE id = $1', [id]);
    const entitiesResult = await pool.query('SELECT * FROM case_entities WHERE case_id = $1', [id]);
    const relationsResult = await pool.query('SELECT * FROM case_relations WHERE case_id = $1', [id]);

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
      'SELECT id, name, entity_type, properties, created_at FROM case_entities WHERE case_id = $1 ORDER BY entity_type, name',
      [id]
    );
    const relationsResult = await pool.query(
      `SELECT cr.id, cr.relation_type,
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
      // 返回 CSV 格式（实体 + 关系两个文件打包在 JSON 中返回 CSV 字符串）
      const entityCsv = 'id,name,entityType,properties,created_at\n' +
        entitiesResult.rows.map(e => {
          const props = typeof e.properties === 'string' ? e.properties : JSON.stringify(e.properties || {});
          return [e.id, `"${(e.name || '').replace(/"/g, '""')}"`, e.entity_type, `"${props.replace(/"/g, '""')}"`, e.created_at].join(',');
        }).join('\n');

      const relationCsv = 'id,type,sourceName,sourceType,targetName,targetType,created_at\n' +
        relationsResult.rows.map(r => {
          return [r.id, `"${(r.relation_type || '').replace(/"/g, '""')}"`,
            `"${(r.source_name || '').replace(/"/g, '""')}"`, r.source_type,
            `"${(r.target_name || '').replace(/"/g, '""')}"`, r.target_type, r.created_at].join(',');
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
      // GraphML 格式（Gephi / Cytoscape 兼容）
      const escapeXml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      let graphml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      graphml += '<graphml xmlns="http://graphml.graphdrawing.org/xmlns">\n';
      graphml += '  <key id="name" for="node" attr.name="name" attr.type="string"/>\n';
      graphml += '  <key id="entityType" for="node" attr.name="entityType" attr.type="string"/>\n';
      graphml += '  <key id="properties" for="node" attr.name="properties" attr.type="string"/>\n';
      graphml += '  <key id="relationType" for="edge" attr.name="relationType" attr.type="string"/>\n';
      graphml += '  <graph id="caseflow-case" edgedefault="directed">\n';

      const nodeElements = entitiesResult.rows.map(e => {
        const props = typeof e.properties === 'string' ? e.properties : JSON.stringify(e.properties || {});
        return `    <node id="${e.id}">\n` +
          `      <data key="name">${escapeXml(e.name)}</data>\n` +
          `      <data key="entityType">${escapeXml(e.entity_type)}</data>\n` +
          `      <data key="properties">${escapeXml(props)}</data>\n` +
          `    </node>`;
      });

      const edgeElements = relationsResult.rows.filter(r => r.source_name && r.target_name).map(r =>
        `    <edge source="${r.source_entity_id || ''}" target="${r.target_entity_id || ''}">\n` +
        `      <data key="relationType">${escapeXml(r.relation_type)}</data>\n` +
        `    </edge>`
      );

      graphml += nodeElements.join('\n') + '\n';
      graphml += edgeElements.join('\n') + '\n';
      graphml += '  </graph>\n';
      graphml += '</graphml>';

      return res.json({
        format: 'graphml',
        graphml,
        case_name: caseData.name,
        total_nodes: entitiesResult.rows.length,
        total_edges: edgeElements.length,
        summary: exportData.summary,
      });
    }

    res.json(exportData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;