/**
 * 存量数据回填：为每个案例创建 legacy 文档、挂载已有分段、按 source_segment_ids 回填证据链
 * 一次性脚本，可重复执行（幂等：document_id 已挂载的分段跳过，evidence 按 (entity_id, segment_id) 去重）
 */
import pool from '../db.js';

const { rows: cases } = await pool.query('SELECT id, name FROM cases ORDER BY id');
let docCount = 0, segLinked = 0, evCreated = 0, entNoSeg = 0, entTotal = 0;

for (const c of cases) {
  // 1. 每案例一个 legacy 文档
  const doc = await pool.query(
    `INSERT INTO documents (case_id, source_type, title)
     SELECT $1, 'legacy', $2
     WHERE NOT EXISTS (SELECT 1 FROM documents WHERE case_id = $1 AND source_type = 'legacy')
     RETURNING id`,
    [c.id, `案例原始材料（迁移）：${String(c.name).slice(0, 200)}`]
  );
  if (doc.rows.length > 0) docCount++;
  const { rows: docRows } = await pool.query(
    `SELECT id FROM documents WHERE case_id = $1 AND source_type = 'legacy' LIMIT 1`, [c.id]
  );
  const docId = docRows[0].id;

  // 2. 挂载该案例尚未归属文档的分段
  const segs = await pool.query(
    `UPDATE text_segments SET document_id = $1
     WHERE case_id = $2 AND document_id IS NULL RETURNING id`,
    [docId, c.id]
  );
  segLinked += segs.rowCount;
  const validSegIds = new Set(segs.rows.map(s => s.id));
  // 已在先前批次挂载的分段也计入有效集合（幂等重跑）
  if (validSegIds.size === 0) {
    const { rows: all } = await pool.query('SELECT id FROM text_segments WHERE case_id = $1', [c.id]);
    all.forEach(s => validSegIds.add(s.id));
  }

  // 3. 实体 → 证据回填
  const ents = await pool.query(
    'SELECT id, source_segment_ids FROM case_entities WHERE case_id = $1', [c.id]
  );
  for (const e of ents.rows) {
    entTotal++;
    const ids = Array.isArray(e.source_segment_ids) ? e.source_segment_ids.map(Number) : [];
    const valid = ids.filter(id => validSegIds.has(id));
    if (valid.length === 0) { entNoSeg++; continue; }
    for (const sid of valid) {
      const ins = await pool.query(
        `INSERT INTO evidence (entity_id, segment_id, quote, source)
         SELECT $1, $2, LEFT(s.content, 800), 'legacy'
         FROM text_segments s WHERE s.id = $2
         AND NOT EXISTS (SELECT 1 FROM evidence WHERE entity_id = $1 AND segment_id = $2)
         RETURNING id`,
        [e.id, sid]
      );
      evCreated += ins.rowCount;
    }
  }
}

console.log(JSON.stringify({
  案例数: cases.length,
  新建legacy文档: docCount,
  挂载分段数: segLinked,
  实体总数: entTotal,
  回填证据条数: evCreated,
  无分段引用的实体: entNoSeg
}, null, 2));
process.exit(0);
