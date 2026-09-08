import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// 稳定键：发布后不可变；未提供时从名称自动生成（与 migration 003 规则一致）
const toStableKey = (name) => {
  if (!name) return null;
  const slug = String(name).split('（')[0].trim().toLowerCase()
    .replace(/ \/ /g, '_').replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
  return slug || `auto_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

// frozen / archived 版本不可直接修改（Spec §5.2 操作权限、§9.1）
// 该 schema 行若被冻结/归档版本引用，则其类型与关系定义只读
async function guardVersionWritable(schemaId, res) {
  const { rows } = await pool.query(
    `SELECT v.id, v.version_key, v.status FROM schema_versions v
     WHERE v.legacy_schema_id = $1 AND v.status IN ('frozen','archived') LIMIT 1`,
    [schemaId]);
  if (rows.length > 0) {
    res.status(409).json({
      error: `Schema 属于${rows[0].status === 'frozen' ? '已冻结' : '已归档'}版本 ${rows[0].version_key}，不可修改。如需调整请创建新草案版本。`,
      version_id: rows[0].id, status: rows[0].status,
    });
    return false;
  }
  return true;
}

// 变更日志：类型/关系修改落到所属草案版本的 schema_changes（Spec §4.2 版本内追溯）
// 仅 draft 版本记录；使用中/冻结/归档版本不在此记录
async function logSchemaChange(schemaId, changeType, targetKey, payload) {
  const { rows } = await pool.query(
    `SELECT v.id FROM schema_versions v
     WHERE v.legacy_schema_id = $1 AND v.status = 'draft' LIMIT 1`, [schemaId]);
  if (rows.length === 0) return;
  await pool.query(
    `INSERT INTO schema_changes (schema_version_id, change_type, target_key, payload)
     VALUES ($1, $2, $3, $4)`,
    [rows[0].id, changeType, targetKey || null, payload ? JSON.stringify(payload) : null]);
}

// Health Check
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// 获取所有 Schema
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM schemas ORDER BY created_at DESC');
    res.json({ schemas: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建 Schema
router.post('/', authMiddleware, async (req, res) => {
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO schemas (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.json({ schema: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除 Schema（FK 已改为 ON DELETE SET NULL，案例保留但清除 schema 关联；
// entity_types / relations / schema_memory 由 DB 层 ON DELETE CASCADE 自动清理）
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    // 统计受影响的案例数
    const caseCount = await pool.query(
      'SELECT COUNT(*) as count FROM cases WHERE schema_id = $1', [id]
    );
    const affectedCases = parseInt(caseCount.rows[0].count);

    const result = await pool.query('DELETE FROM schemas WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schema 不存在' });
    }

    res.json({
      message: 'Schema 已删除',
      affectedCases, // 受影响的案例数（已自动 set schema_id = NULL）
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新 Schema
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, description, layout } = req.body;
  try {
    const result = await pool.query(
      'UPDATE schemas SET name = COALESCE($1, name), description = COALESCE($2, description), layout = COALESCE($3, layout) WHERE id = $4 RETURNING *',
      [name, description, layout ? JSON.stringify(layout) : null, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Schema not found' });
    }
    res.json({ schema: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个 Schema 详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const schemaResult = await pool.query('SELECT * FROM schemas WHERE id = $1', [id]);
    const entityTypesResult = await pool.query('SELECT * FROM entity_types WHERE schema_id = $1', [id]);
    const relationsResult = await pool.query('SELECT * FROM relations WHERE schema_id = $1', [id]);

    res.json({
      schema: schemaResult.rows[0],
      entityTypes: entityTypesResult.rows,
      relations: relationsResult.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加实体类型
router.post('/:schemaId/entity-types', authMiddleware, async (req, res) => {
  const { schemaId } = req.params;
  if (!(await guardVersionWritable(schemaId, res))) return;
  const { name, color, description, properties } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO entity_types (schema_id, name, color, description, properties, stable_key) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [schemaId, name, color, description || '', JSON.stringify(properties || []), toStableKey(name)]
    );
    await logSchemaChange(schemaId, 'add_entity_type', result.rows[0].stable_key,
      { name: result.rows[0].name, color });
    res.json({ entityType: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新实体类型
router.put('/:schemaId/entity-types/:entityTypeId', authMiddleware, async (req, res) => {
  const { schemaId, entityTypeId } = req.params;
  if (!(await guardVersionWritable(schemaId, res))) return;
  const { name, color, description, properties } = req.body;
  try {
    const result = await pool.query(
      'UPDATE entity_types SET name = COALESCE($1, name), color = COALESCE($2, color), description = COALESCE($3, description), properties = COALESCE($4, properties) WHERE id = $5 AND schema_id = $6 RETURNING *',
      [name, color, description, JSON.stringify(properties), entityTypeId, schemaId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entity type not found' });
    }
    await logSchemaChange(schemaId, 'edit_entity_type', result.rows[0].stable_key,
      { name: result.rows[0].name, color: result.rows[0].color, properties: result.rows[0].properties });
    res.json({ entityType: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除实体类型
router.delete('/:schemaId/entity-types/:entityTypeId', authMiddleware, async (req, res) => {
  const { schemaId, entityTypeId } = req.params;
  if (!(await guardVersionWritable(schemaId, res))) return;
  try {
    const existing = await pool.query(
      'SELECT name, stable_key FROM entity_types WHERE id = $1 AND schema_id = $2', [entityTypeId, schemaId]);
    await pool.query('DELETE FROM entity_types WHERE id = $1 AND schema_id = $2', [entityTypeId, schemaId]);
    if (existing.rows.length > 0) {
      await logSchemaChange(schemaId, 'remove_entity_type', existing.rows[0].stable_key,
        { name: existing.rows[0].name });
    }
    res.json({ message: 'Entity type deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加关系定义
router.post('/:schemaId/relations', authMiddleware, async (req, res) => {
  const { schemaId } = req.params;
  if (!(await guardVersionWritable(schemaId, res))) return;
  const { name, fromEntityType, toEntityType, description, direction, color, style, properties } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO relations (schema_id, name, from_entity_type, to_entity_type, description, direction, color, style, properties, stable_key) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
      [schemaId, name, fromEntityType, toEntityType, description, direction || 'directed', color || '#9ca3af', style || 'solid', JSON.stringify(properties || []), toStableKey(name)]
    );
    await logSchemaChange(schemaId, 'add_relation', result.rows[0].stable_key,
      { name: result.rows[0].name, from_entity_type: fromEntityType, to_entity_type: toEntityType });
    res.json({ relation: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新关系定义
router.put('/:schemaId/relations/:relationId', authMiddleware, async (req, res) => {
  const { schemaId, relationId } = req.params;
  if (!(await guardVersionWritable(schemaId, res))) return;
  const { name, fromEntityType, toEntityType, description, direction, color, style, properties } = req.body;
  try {
    const result = await pool.query(
      `UPDATE relations SET
        name = COALESCE($1, name),
        from_entity_type = COALESCE($2, from_entity_type),
        to_entity_type = COALESCE($3, to_entity_type),
        description = COALESCE($4, description),
        direction = COALESCE($5, direction),
        color = COALESCE($6, color),
        style = COALESCE($7, style),
        properties = COALESCE($8, properties)
      WHERE id = $9 AND schema_id = $10 RETURNING *`,
      [name, fromEntityType, toEntityType, description, direction, color, style, JSON.stringify(properties), relationId, schemaId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Relation not found' });
    }
    await logSchemaChange(schemaId, 'edit_relation', result.rows[0].stable_key,
      { name: result.rows[0].name, from_entity_type: result.rows[0].from_entity_type, to_entity_type: result.rows[0].to_entity_type });
    res.json({ relation: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除关系定义
router.delete('/:schemaId/relations/:relationId', authMiddleware, async (req, res) => {
  const { schemaId, relationId } = req.params;
  if (!(await guardVersionWritable(schemaId, res))) return;
  try {
    const existing = await pool.query(
      'SELECT name, stable_key FROM relations WHERE id = $1 AND schema_id = $2', [relationId, schemaId]);
    await pool.query('DELETE FROM relations WHERE id = $1 AND schema_id = $2', [relationId, schemaId]);
    if (existing.rows.length > 0) {
      await logSchemaChange(schemaId, 'remove_relation', existing.rows[0].stable_key,
        { name: existing.rows[0].name });
    }
    res.json({ message: 'Relation deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;