import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

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

// 删除 Schema
router.delete('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM schemas WHERE id = $1', [id]);
    res.json({ message: 'Schema deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新 Schema
router.put('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE schemas SET name = COALESCE($1, name), description = COALESCE($2, description) WHERE id = $3 RETURNING *',
      [name, description, id]
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
  const { name, color, properties } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO entity_types (schema_id, name, color, properties) VALUES ($1, $2, $3, $4) RETURNING *',
      [schemaId, name, color, JSON.stringify(properties || [])]
    );
    res.json({ entityType: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新实体类型
router.put('/:schemaId/entity-types/:entityTypeId', authMiddleware, async (req, res) => {
  const { schemaId, entityTypeId } = req.params;
  const { name, color, properties } = req.body;
  try {
    const result = await pool.query(
      'UPDATE entity_types SET name = COALESCE($1, name), color = COALESCE($2, color), properties = COALESCE($3, properties) WHERE id = $4 AND schema_id = $5 RETURNING *',
      [name, color, JSON.stringify(properties), entityTypeId, schemaId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Entity type not found' });
    }
    res.json({ entityType: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除实体类型
router.delete('/:schemaId/entity-types/:entityTypeId', authMiddleware, async (req, res) => {
  const { schemaId, entityTypeId } = req.params;
  try {
    await pool.query('DELETE FROM entity_types WHERE id = $1 AND schema_id = $2', [entityTypeId, schemaId]);
    res.json({ message: 'Entity type deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加关系定义
router.post('/:schemaId/relations', authMiddleware, async (req, res) => {
  const { schemaId } = req.params;
  const { name, fromEntityType, toEntityType, description, direction, color, style, properties } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO relations (schema_id, name, from_entity_type, to_entity_type, description, direction, color, style, properties) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
      [schemaId, name, fromEntityType, toEntityType, description, direction || 'directed', color || '#9ca3af', style || 'solid', JSON.stringify(properties || [])]
    );
    res.json({ relation: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新关系定义
router.put('/:schemaId/relations/:relationId', authMiddleware, async (req, res) => {
  const { schemaId, relationId } = req.params;
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
    res.json({ relation: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除关系定义
router.delete('/:schemaId/relations/:relationId', authMiddleware, async (req, res) => {
  const { schemaId, relationId } = req.params;
  try {
    await pool.query('DELETE FROM relations WHERE id = $1 AND schema_id = $2', [relationId, schemaId]);
    res.json({ message: 'Relation deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;