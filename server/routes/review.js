import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { assertCaseAccess, assertTargetAccess } from '../middleware/caseAccess.js';

const router = express.Router();

// 所有审核路由都需要登录（Spec §6.4：操作写入 review_decisions，含操作者）
router.use(authMiddleware);

// ------------------------------------------------------------
// 通用：写审核决策 + 更新目标状态
// ------------------------------------------------------------

async function recordDecision(client, { targetType, targetId, caseId, action, oldValue, newValue, reason, operatorId }) {
  await client.query(
    `INSERT INTO review_decisions (target_type, target_id, case_id, action, old_value, new_value, reason, operator_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [targetType, targetId, caseId, action,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      reason || null, operatorId || null]
  );
}

function makeStatusHandler(targetType, action) {
  return async (req, res) => {
    const { id } = req.params;
    if (!['approve', 'reject', 'edit', 'restore'].includes(action)) {
      return res.status(400).json({ error: `不支持的操作: ${action}` });
    }
    const { reason, name, entityType, properties, relationType, sourceEntityId, targetEntityId } = req.body || {};
    const operatorId = req.user?.id || null;
    await assertTargetAccess(operatorId, targetType === 'entity' ? { entityId: id } : { relationId: id });
    const table = targetType === 'entity' ? 'case_entities' : 'case_relations';

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(`SELECT * FROM ${table} WHERE id = $1 FOR UPDATE`, [id]);
      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `${targetType} 不存在` });
      }
      const old = rows[0];
      if (old.case_id) { /* case_id 用于决策索引 */ }

      let newValue = {};
      let newStatus = old.status;

      if (action === 'approve') {
        newStatus = 'confirmed';
        newValue = { status: newStatus };
      } else if (action === 'reject') {
        newStatus = 'rejected';
        newValue = { status: newStatus };
      } else if (action === 'restore') {
        newStatus = 'confirmed';
        newValue = { status: newStatus };
      } else if (action === 'edit') {
        if (targetType === 'entity') {
          if (name !== undefined) newValue.name = name;
          if (entityType !== undefined) newValue.entity_type = entityType;
          if (properties !== undefined) newValue.properties = properties;
        } else {
          if (relationType !== undefined) newValue.relation_type = relationType;
          if (sourceEntityId !== undefined) newValue.source_entity_id = sourceEntityId;
          if (targetEntityId !== undefined) newValue.target_entity_id = targetEntityId;
        }
        newStatus = 'confirmed'; // 编辑视为人工确认
        newValue.status = newStatus;
      }

      // 应用更新
      const sets = ['status = $1', 'reviewed_by = $2', 'reviewed_at = CURRENT_TIMESTAMP'];
      const params = [newStatus, operatorId];
      let p = params.length;
      if (newValue.name !== undefined) { p++; sets.push(`name = $${p}`); params.push(newValue.name); }
      if (newValue.entity_type !== undefined) { p++; sets.push(`entity_type = $${p}`); params.push(newValue.entity_type); }
      if (newValue.properties !== undefined) { p++; sets.push(`properties = $${p}`); params.push(JSON.stringify(newValue.properties)); }
      if (newValue.relation_type !== undefined) { p++; sets.push(`relation_type = $${p}`); params.push(newValue.relation_type); }
      if (newValue.source_entity_id !== undefined) { p++; sets.push(`source_entity_id = $${p}`); params.push(newValue.source_entity_id); }
      if (newValue.target_entity_id !== undefined) { p++; sets.push(`target_entity_id = $${p}`); params.push(newValue.target_entity_id); }
      p++; params.push(id);
      const updated = await client.query(`UPDATE ${table} SET ${sets.join(', ')} WHERE id = $${p} RETURNING *`, params);

      await recordDecision(client, {
        targetType, targetId: Number(id), caseId: old.case_id, action,
        oldValue: {
          name: old.name, entity_type: old.entity_type, relation_type: old.relation_type,
          source_entity_id: old.source_entity_id, target_entity_id: old.target_entity_id,
          properties: old.properties, status: old.status
        },
        newValue: { ...newValue, reason }, operatorId
      });

      await client.query('COMMIT');
      res.json({ success: true, [targetType]: updated.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      console.error(`[review/${targetType}/${action}] 错误:`, error.message);
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  };
}

// ------------------------------------------------------------
// 实体审核（Express 5 path-to-regexp 不支持内联正则，显式注册各动作）
// ------------------------------------------------------------
for (const action of ['approve', 'reject', 'edit', 'restore']) {
  router.post(`/entity/:id/${action}`, makeStatusHandler('entity', action));
  router.post(`/relation/:id/${action}`, makeStatusHandler('relation', action));
}
router.get('/entity/:id/history', async (req, res) => {
  try {
    await assertTargetAccess(req.user.id, { entityId: req.params.id });
    const { rows } = await pool.query(
      `SELECT rd.*, u.username AS operator_name
       FROM review_decisions rd LEFT JOIN users u ON u.id = rd.operator_id
       WHERE rd.target_type = 'entity' AND rd.target_id = $1 ORDER BY rd.created_at DESC`,
      [req.params.id]
    );
    res.json({ history: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------
// 关系审核（动作路由已在上方循环中统一注册）
// ------------------------------------------------------------
router.get('/relation/:id/history', async (req, res) => {
  try {
    await assertTargetAccess(req.user.id, { relationId: req.params.id });
    const { rows } = await pool.query(
      `SELECT rd.*, u.username AS operator_name
       FROM review_decisions rd LEFT JOIN users u ON u.id = rd.operator_id
       WHERE rd.target_type = 'relation' AND rd.target_id = $1 ORDER BY rd.created_at DESC`,
      [req.params.id]
    );
    res.json({ history: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ------------------------------------------------------------
// 审核队列：按案例列出各状态实体/关系
// GET /api/review/queues?case_id=1&status=pending（status 缺省返回全部+计数）
// ------------------------------------------------------------
router.get('/queues', async (req, res) => {
  try {
    const caseId = parseInt(req.query.case_id, 10);
    if (!caseId) return res.status(400).json({ error: 'case_id 必填' });
    await assertCaseAccess(req.user.id, caseId);
    const statusFilter = req.query.status || null;

    const entSql = `
      SELECT id, name, entity_type, color, status, properties, created_at, reviewed_at
      FROM case_entities WHERE case_id = $1 ${statusFilter ? 'AND status = $2' : ''}
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END, created_at DESC`;
    const relSql = `
      SELECT r.id, r.relation_type, r.status, r.source_entity_id, r.target_entity_id, r.created_at, r.reviewed_at,
             s.name AS source_name, s.entity_type AS source_type,
             t.name AS target_name, t.entity_type AS target_type
      FROM case_relations r
      LEFT JOIN case_entities s ON s.id = r.source_entity_id
      LEFT JOIN case_entities t ON t.id = r.target_entity_id
      WHERE r.case_id = $1 ${statusFilter ? 'AND r.status = $2' : ''}
      ORDER BY CASE r.status WHEN 'pending' THEN 0 WHEN 'confirmed' THEN 1 ELSE 2 END, r.created_at DESC`;

    const [entRes, relRes, factRes] = await Promise.all([
      pool.query(entSql, statusFilter ? [caseId, statusFilter] : [caseId]),
      pool.query(relSql, statusFilter ? [caseId, statusFilter] : [caseId]),
      pool.query(`SELECT id, fact_text, fact_type, status, segment_id, metadata, created_at
                  FROM atomic_facts WHERE case_id = $1 ORDER BY created_at DESC LIMIT 500`, [caseId]),
    ]);

    const countBy = (rows) => ({
      pending: rows.filter(r => r.status === 'pending').length,
      confirmed: rows.filter(r => r.status === 'confirmed').length,
      rejected: rows.filter(r => r.status === 'rejected').length,
    });

    res.json({
      case_id: caseId,
      entities: entRes.rows,
      relations: relRes.rows,
      facts: factRes.rows,
      counts: { entities: countBy(entRes.rows), relations: countBy(relRes.rows) },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
