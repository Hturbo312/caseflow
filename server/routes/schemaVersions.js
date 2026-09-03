import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

/**
 * Schema 版本服务（Spec §6.1）
 * - 只有登录研究者可以创建草案 / 批准 / 冻结 / 归档；
 * - frozen / archived 版本不可修改；
 * - 类型删除 = deprecated，不物理删除（在 diff/change-log 中体现）；
 * - schemas 表保留为兼容层：每个版本通过 legacy_schema_id 指向一个 legacy schema 行，
 *   draft 创建时克隆父版本类型，发布后其 legacy schema 承接案例。
 */

const VERSION_WITH_FAMILY = `
  SELECT v.*, f.key AS family_key, f.name AS family_name, s.name AS legacy_schema_name
  FROM schema_versions v
  JOIN schema_families f ON f.id = v.family_id
  LEFT JOIN schemas s ON s.id = v.legacy_schema_id`;

async function getVersion(id) {
  const { rows } = await pool.query(`${VERSION_WITH_FAMILY} WHERE v.id = $1`, [id]);
  return rows[0] || null;
}

async function logChange(versionId, changeType, targetKey, payload, userId, client = pool) {
  await client.query(
    `INSERT INTO schema_changes (schema_version_id, change_type, target_key, payload, created_by)
     VALUES ($1, $2, $3, $4, $5)`,
    [versionId, changeType, targetKey || null, payload ? JSON.stringify(payload) : null, userId || null]
  );
}

// ============ 家族 ============
router.get('/schema-families', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT f.*,
             (SELECT COUNT(*)::int FROM schema_versions v WHERE v.family_id = f.id) AS version_count,
             (SELECT json_build_object('id', v.id, 'version_key', v.version_key, 'status', v.status)
              FROM schema_versions v WHERE v.family_id = f.id AND v.status = 'active' LIMIT 1) AS active_version
      FROM schema_families f ORDER BY f.id`);
    res.json({ families: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/schema-families/:id/versions', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `${VERSION_WITH_FAMILY} WHERE v.family_id = $1 ORDER BY v.created_at DESC`, [req.params.id]);
    res.json({ versions: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 创建草案（克隆父版本类型到新 legacy schema 行） ============
router.post('/schema-versions/draft', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { familyId, versionKey, parentVersionId, researchQuestion, changeReason } = req.body;
    if (!familyId || !versionKey) return res.status(400).json({ error: 'familyId 和 versionKey 必填' });
    if (!/^v\d+\.\d+(\.\d+)?$/.test(versionKey)) {
      return res.status(400).json({ error: 'version_key 需形如 v1.1 / v2.0' });
    }

    const fam = await pool.query('SELECT * FROM schema_families WHERE id = $1', [familyId]);
    if (fam.rows.length === 0) return res.status(404).json({ error: 'family 不存在' });

    const dup = await pool.query(
      'SELECT 1 FROM schema_versions WHERE family_id = $1 AND version_key = $2', [familyId, versionKey]);
    if (dup.rows.length > 0) return res.status(409).json({ error: '该版本号已存在' });

    const parent = parentVersionId ? await getVersion(parentVersionId) : await pool.query(
      `${VERSION_WITH_FAMILY} WHERE v.family_id = $1 AND v.status IN ('active','frozen') ORDER BY v.created_at DESC LIMIT 1`,
      [familyId]).then(r => r.rows[0] || null);
    if (!parent) return res.status(400).json({ error: '缺少父版本（family 尚无 active/frozen 版本）' });

    await client.query('BEGIN');

    // 1. 新 legacy schema 行（兼容层克隆）
    const legacyRes = await client.query(
      `INSERT INTO schemas (name, description, layout)
       SELECT $1, $2, COALESCE(p.layout, '{}'::jsonb)
       FROM schemas p WHERE p.id = $3 RETURNING id`,
      [`[draft] ${fam.rows[0].name} ${versionKey}`,
       `Draft ${versionKey} of family ${fam.rows[0].key}，克隆自 ${parent.version_key}`,
       parent.legacy_schema_id]
    );
    const legacyId = legacyRes.rows[0].id;

    // 2. 克隆实体类型与关系（保留 stable_key）
    await client.query(
      `INSERT INTO entity_types (schema_id, name, color, properties, stable_key)
       SELECT $1, name, color, properties, stable_key FROM entity_types WHERE schema_id = $2`,
      [legacyId, parent.legacy_schema_id]);
    await client.query(
      `INSERT INTO relations (schema_id, name, from_entity_type, to_entity_type, description, direction, color, style, properties, stable_key)
       SELECT $1, name, from_entity_type, to_entity_type, description, direction, color, style, properties, stable_key
       FROM relations WHERE schema_id = $2`,
      [legacyId, parent.legacy_schema_id]);

    // 3. 版本行
    const verRes = await client.query(
      `INSERT INTO schema_versions
         (family_id, version_key, legacy_schema_id, parent_version_id, status, research_question, change_reason, created_by)
       VALUES ($1,$2,$3,$4,'draft',$5,$6,$7) RETURNING *`,
      [familyId, versionKey, legacyId, parent.id, researchQuestion || null, changeReason || null, req.user.id]);

    await logChange(verRes.rows[0].id, 'create_draft', versionKey,
      { parent: parent.version_key, cloned_from_legacy: parent.legacy_schema_id }, req.user.id, client);

    await client.query('COMMIT');
    res.json({ version: verRes.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// ============ 版本详情 ============
router.get('/schema-versions/:id', async (req, res) => {
  try {
    const version = await getVersion(req.params.id);
    if (!version) return res.status(404).json({ error: '版本不存在' });
    const [typesRes, relRes, changesRes] = await Promise.all([
      pool.query('SELECT id, name, color, properties, stable_key FROM entity_types WHERE schema_id = $1 ORDER BY id', [version.legacy_schema_id]),
      pool.query('SELECT id, name, from_entity_type, to_entity_type, direction, color, style, stable_key FROM relations WHERE schema_id = $1 ORDER BY id', [version.legacy_schema_id]),
      pool.query(`SELECT sc.*, u.username AS creator FROM schema_changes sc
                  LEFT JOIN users u ON u.id = sc.created_by
                  WHERE sc.schema_version_id = $1 ORDER BY sc.created_at DESC LIMIT 100`, [version.id]),
    ]);
    res.json({ version, entity_types: typesRes.rows, relations: relRes.rows, changes: changesRes.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 版本差异（与父版本按 stable_key 对比） ============
router.get('/schema-versions/:id/diff', async (req, res) => {
  try {
    const version = await getVersion(req.params.id);
    if (!version) return res.status(404).json({ error: '版本不存在' });
    if (!version.parent_version_id) {
      return res.json({ version_key: version.version_key, parent_version: null, note: '首版无父版本', entity_types: { added: [], removed: [], renamed: [] }, relations: { added: [], removed: [], direction_changed: [] } });
    }
    const parent = await getVersion(version.parent_version_id);
    const [childTypes, parentTypes, childRels, parentRels] = await Promise.all([
      pool.query('SELECT name, stable_key FROM entity_types WHERE schema_id = $1', [version.legacy_schema_id]),
      pool.query('SELECT name, stable_key FROM entity_types WHERE schema_id = $1', [parent.legacy_schema_id]),
      pool.query('SELECT name, stable_key, from_entity_type, to_entity_type, direction FROM relations WHERE schema_id = $1', [version.legacy_schema_id]),
      pool.query('SELECT name, stable_key, from_entity_type, to_entity_type, direction FROM relations WHERE schema_id = $1', [parent.legacy_schema_id]),
    ]);

    const byKey = (rows) => new Map(rows.filter(r => r.stable_key).map(r => [r.stable_key, r]));
    const pt = byKey(parentTypes.rows), ct = byKey(childTypes.rows);
    const pr = byKey(parentRels.rows), cr = byKey(childRels.rows);

    res.json({
      version_key: version.version_key,
      parent_version: parent.version_key,
      entity_types: {
        added: [...ct.keys()].filter(k => !pt.has(k)).map(k => ({ stable_key: k, name: ct.get(k).name })),
        removed: [...pt.keys()].filter(k => !ct.has(k)).map(k => ({ stable_key: k, name: pt.get(k).name })),
        renamed: [...ct.keys()].filter(k => pt.has(k) && pt.get(k).name !== ct.get(k).name)
          .map(k => ({ stable_key: k, from: pt.get(k).name, to: ct.get(k).name })),
      },
      relations: {
        added: [...cr.keys()].filter(k => !pr.has(k)).map(k => ({ stable_key: k, name: cr.get(k).name })),
        removed: [...pr.keys()].filter(k => !cr.has(k)).map(k => ({ stable_key: k, name: pr.get(k).name })),
        direction_changed: [...cr.keys()].filter(k => pr.has(k) &&
            (pr.get(k).from_entity_type !== cr.get(k).from_entity_type ||
             pr.get(k).to_entity_type !== cr.get(k).to_entity_type))
          .map(k => ({ stable_key: k, name: cr.get(k).name, from: `${pr.get(k).from_entity_type}→${pr.get(k).to_entity_type}`, to: `${cr.get(k).from_entity_type}→${cr.get(k).to_entity_type}` })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 影响分析（发布前必看，Spec §5.2） ============
router.get('/schema-versions/:id/impact', async (req, res) => {
  try {
    const version = await getVersion(req.params.id);
    if (!version) return res.status(404).json({ error: '版本不存在' });
    const legacyId = version.legacy_schema_id;

    const [casesRes, entsRes, relsRes, factsRes] = await Promise.all([
      pool.query('SELECT COUNT(*)::int AS n FROM cases WHERE schema_id = $1', [legacyId]),
      pool.query(`SELECT COUNT(*)::int AS n FROM case_entities WHERE schema_version_id = $1`, [version.id]),
      pool.query(`SELECT COUNT(*)::int AS n FROM case_relations WHERE schema_version_id = $1`, [version.id]),
      pool.query(`SELECT
            COUNT(*) FILTER (WHERE assertion_status = 'pending')::int AS pending,
            COUNT(*)::int AS total
          FROM fact_entity_assertions WHERE schema_version_id = $1`, [version.id]),
    ]);

    res.json({
      version_key: version.version_key,
      status: version.status,
      affected_cases: casesRes.rows[0].n,
      typed_entities: entsRes.rows[0].n,
      typed_relations: relsRes.rows[0].n,
      fact_assertions: factsRes.rows[0],
      // 草案版尚未承接案例 → 待重抽取案例为 0；发布后按需创建 migration run
      cases_to_reextract: 0,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ 状态机：approve / freeze / archive ============
// freeze 允许 draft（Spec §8.1「冻结实验版本」）与 active 两种来源；
// approve 允许 draft 与 frozen（先冻结锁定内容、再发布为 active）
const TRANSITIONS = {
  approve: { from: ['draft', 'frozen'], to: 'active' },
  freeze: { from: ['draft', 'active'], to: 'frozen' },
  archive: { from: ['active', 'frozen', 'draft'], to: 'archived' },
};

for (const [action, rule] of Object.entries(TRANSITIONS)) {
  router.post(`/schema-versions/:id/${action}`, authMiddleware, async (req, res) => {
    const client = await pool.connect();
    try {
      const version = await getVersion(req.params.id);
      if (!version) return res.status(404).json({ error: '版本不存在' });
      if (!rule.from.includes(version.status)) {
        return res.status(409).json({ error: `状态 ${version.status} 不允许 ${action}（仅 ${rule.from.join('/')}）` });
      }

      await client.query('BEGIN');
      // approve：同 family 其它 active 版本归档
      if (action === 'approve') {
        await client.query(
          `UPDATE schema_versions SET status = 'archived'
           WHERE family_id = $1 AND status = 'active' AND id <> $2`,
          [version.family_id, version.id]);
        await client.query(
          `UPDATE schema_versions SET status = 'active', approved_by = $2, approved_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [version.id, req.user.id]);
        // 案例随版本迁移：父版本 legacy schema → 本版本 legacy schema
        if (version.parent_version_id) {
          const parent = await getVersion(version.parent_version_id);
          if (parent?.legacy_schema_id) {
            await client.query(`UPDATE cases SET schema_id = $1 WHERE schema_id = $2`,
              [version.legacy_schema_id, parent.legacy_schema_id]);
            // 类型外键改指向本版本克隆出的类型行（按 stable_key 对位）
            await client.query(
              `UPDATE case_entities ce SET entity_type_id = nt.id, schema_version_id = $1
               FROM entity_types ot, entity_types nt
               WHERE ot.schema_id = $2 AND nt.schema_id = $3 AND nt.stable_key = ot.stable_key
                 AND ce.entity_type_id = ot.id`,
              [version.id, parent.legacy_schema_id, version.legacy_schema_id]);
            await client.query(
              `UPDATE case_relations cr SET relation_type_id = nr.id, schema_version_id = $1
               FROM relations orr, relations nr
               WHERE orr.schema_id = $2 AND nr.schema_id = $3 AND nr.stable_key = orr.stable_key
                 AND cr.relation_type_id = orr.id`,
              [version.id, parent.legacy_schema_id, version.legacy_schema_id]);
          }
        }
        // 正式化 legacy schema 名称：草案克隆行带着「[draft]」前缀，发布后改为正式名
        await client.query(
          `UPDATE schemas SET name = $1, description = COALESCE($2, description) WHERE id = $3`,
          [`${version.family_name || 'Dynamic Schema'} ${version.version_key}`,
           version.research_question, version.legacy_schema_id]);
      } else if (action === 'freeze') {
        await client.query(
          `UPDATE schema_versions SET status = 'frozen', frozen_at = CURRENT_TIMESTAMP WHERE id = $1`, [version.id]);
      } else {
        await client.query(`UPDATE schema_versions SET status = 'archived' WHERE id = $1`, [version.id]);
      }

      await logChange(version.id, action, version.version_key, { from: version.status, to: rule.to }, req.user.id, client);
      await client.query('COMMIT');
      res.json({ success: true, version: await getVersion(version.id) });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      res.status(500).json({ error: error.message });
    } finally {
      client.release();
    }
  });
}

// ============ 变更日志 ============
router.get('/schema-versions/:id/change-log', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT sc.*, u.username AS creator FROM schema_changes sc
       LEFT JOIN users u ON u.id = sc.created_by
       WHERE sc.schema_version_id = $1 ORDER BY sc.created_at DESC`,
      [req.params.id]);
    res.json({ changes: rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
