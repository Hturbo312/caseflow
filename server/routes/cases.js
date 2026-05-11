import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// 获取所有案例
router.get('/', async (req, res) => {
  try {
    const casesResult = await pool.query('SELECT * FROM cases ORDER BY created_at DESC');
    const cases = casesResult.rows;

    const casesWithDetails = await Promise.all(cases.map(async (c) => {
      const entitiesResult = await pool.query('SELECT * FROM case_entities WHERE case_id = $1', [c.id]);
      const relationsResult = await pool.query('SELECT * FROM case_relations WHERE case_id = $1', [c.id]);

      return {
        ...c,
        schemaId: c.schema_id?.toString(),
        entities: entitiesResult.rows.map(e => ({
          ...e,
          id: e.id?.toString(),
          caseId: e.case_id?.toString(),
          entityType: e.entity_type
        })),
        relations: relationsResult.rows.map(r => ({
          ...r,
          id: r.id?.toString(),
          caseId: r.case_id?.toString(),
          sourceId: r.source_entity_id?.toString(),
          targetId: r.target_entity_id?.toString(),
          name: r.relation_type
        }))
      };
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

// 获取案例详情
router.get('/:id', async (req, res) => {
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

export default router;