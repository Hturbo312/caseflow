import pool from '../db.js';

export async function assertCaseAccess(userId, caseId, roles = null) {
  const params = [Number(caseId), userId];
  const roleClause = roles ? ' AND ca.role = ANY($3::text[])' : '';
  if (roles) params.push(roles);
  const { rows } = await pool.query(`SELECT ca.role FROM case_access ca WHERE ca.case_id=$1 AND ca.user_id=$2${roleClause}`, params);
  if (!rows[0]) { const error = new Error('案例不存在或当前用户无权访问'); error.status = 403; throw error; }
  return rows[0].role;
}

export async function accessibleCaseIds(userId, caseIds) {
  const ids = [...new Set((Array.isArray(caseIds) ? caseIds : [caseIds]).map(Number).filter(Number.isInteger))];
  if (!ids.length) return [];
  const { rows } = await pool.query('SELECT case_id FROM case_access WHERE user_id=$1 AND case_id=ANY($2::int[])', [userId, ids]);
  return rows.map(row => row.case_id);
}


export async function assertTargetAccess(userId, { entityId, relationId }) {
  const id = Number(entityId ?? relationId);
  const column = entityId != null ? 'ce.id' : 'cr.id';
  if (!Number.isInteger(id)) { const error = new Error('实体或关系 ID 无效'); error.status = 400; throw error; }
  const { rows } = await pool.query(`SELECT 1 FROM case_access ca
    JOIN cases c ON c.id=ca.case_id
    LEFT JOIN case_entities ce ON ce.case_id=c.id AND $3='ce' AND ce.id=$1
    LEFT JOIN case_relations cr ON cr.case_id=c.id AND $3='cr' AND cr.id=$1
    WHERE ca.user_id=$2 AND ${column}=$1`, [id, userId, entityId != null ? 'ce' : 'cr']);
  if (!rows[0]) { const error = new Error('目标不存在或当前用户无权访问'); error.status = 403; throw error; }
}
