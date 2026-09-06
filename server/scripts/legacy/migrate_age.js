import pool from './db.js';

/**
 * 将现有关系表数据迁移到 Apache AGE 图数据库。
 * 使用 agtype_in()/agtype_out() 绕过 jsonb→agtype 强转限制。
 */

async function migrateToAGE() {
  try {
    await pool.query('SET search_path TO ag_catalog, public, "$user";');

    const schemas = await pool.query('SELECT id, name FROM schemas');
    console.log(`找到 ${schemas.rows.length} 个 Schema`);

    for (const schema of schemas.rows) {
      const graphName = `schema_${schema.id}`;
      console.log(`\n--- Schema ${schema.id}: ${schema.name} (图: ${graphName}) ---`);

      const existing = await pool.query('SELECT graphid FROM ag_graph WHERE name = $1', [graphName]);
      if (existing.rows.length > 0) {
        console.log(`  图已存在, 删除重建...`);
        await pool.query("SELECT drop_graph($1, true)", [graphName]);
      }

      await pool.query("SELECT create_graph($1)", [graphName]);
      await pool.query("SELECT create_vlabel($1, 'Entity')", [graphName]);
      await pool.query("SELECT create_elabel($1, 'RelatesTo')", [graphName]);
      console.log(`  ✓ 图 + 标签创建成功`);

      const entities = await pool.query(
        `SELECT ce.id AS db_id, ce.case_id, ce.name, ce.entity_type, ce.properties,
                c.name AS case_name
         FROM case_entities ce
         JOIN cases c ON ce.case_id = c.id
         WHERE c.schema_id = $1`,
        [schema.id]
      );

      if (entities.rows.length === 0) {
        console.log('  无实体数据, 跳过');
        continue;
      }

      // 用 SQL 函数直接从源表构建 agtype 并插入, 避免 Node.js 转义问题
      await pool.query(`
        INSERT INTO "${graphName}"."Entity" (properties)
        SELECT ag_catalog.agtype_in(
          json_build_object(
            'db_id', ce.id,
            'name', ce.name,
            'entity_type', ce.entity_type,
            'case_id', ce.case_id,
            'case_name', c.name,
            'properties', coalesce(ce.properties, '{}'::jsonb),
            'source_segment_ids', ce.properties->'source_segment_ids'
          )::text::cstring
        )
        FROM case_entities ce
        JOIN cases c ON ce.case_id = c.id
        WHERE c.schema_id = $1
      `, [schema.id]);

      console.log(`  ✓ 实体导入完成 (${entities.rows.length} 个)`);

      // 建立 db_id → AGE id 映射
      const mapTable = `emap_${Date.now()}`;
      await pool.query(`
        CREATE TEMP TABLE ${mapTable} AS
        SELECT
          (ag_catalog.agtype_out(e.properties)::text::jsonb->>'db_id')::bigint AS db_id,
          e.id
        FROM "${graphName}"."Entity" e
      `);

      // 导入关系
      const relations = await pool.query(
        `SELECT cr.id AS rel_db_id, cr.relation_type,
                cr.source_entity_id, cr.target_entity_id
         FROM case_relations cr
         JOIN cases c ON cr.case_id = c.id
         WHERE c.schema_id = $1`,
        [schema.id]
      );

      if (relations.rows.length > 0) {
        await pool.query(`
          INSERT INTO "${graphName}"."RelatesTo" (start_id, end_id, properties)
          SELECT
            (SELECT m.id FROM ${mapTable} m WHERE m.db_id = cr.source_entity_id),
            (SELECT m.id FROM ${mapTable} m WHERE m.db_id = cr.target_entity_id),
            ag_catalog.agtype_in(json_build_object(
              'db_id', cr.id,
              'relation_type', cr.relation_type
            )::text::cstring)
          FROM case_relations cr
          JOIN cases c ON cr.case_id = c.id
          WHERE c.schema_id = $1
        `, [schema.id]);
      }

      await pool.query(`DROP TABLE IF EXISTS ${mapTable}`);
      console.log(`  ✓ 关系导入完成 (${relations.rows.length} 条)`);
    }

    // 验证
    console.log('\n=== 迁移完成 ===');
    for (const schema of schemas.rows) {
      const graphName = `schema_${schema.id}`;
      const v = await pool.query(`SELECT count(*) AS cnt FROM "${graphName}"."Entity"`);
      const e = await pool.query(`SELECT count(*) AS cnt FROM "${graphName}"."RelatesTo"`);
      console.log(`  图 ${graphName}: ${v.rows[0].cnt} 个顶点, ${e.rows[0].cnt} 条边`);
    }

    // Cypher 查询测试
    console.log('\n=== Cypher 查询测试 ===');
    const test = await pool.query(
      `SELECT * FROM cypher('schema_3', $$
        MATCH (n:Entity) RETURN n.name AS name, n.entity_type AS type LIMIT 3
      $$) AS (name agtype, type agtype);`
    );
    for (const row of test.rows) {
      console.log(`  ${row.name} (${row.type})`);
    }

    // 测试图遍历
    console.log('\n=== 图遍历测试 (两跳关系) ===');
    const traverse = await pool.query(
      `SELECT * FROM cypher('schema_3', $$
        MATCH (a:Entity {name: 'Gap Filler'})-[:RelatesTo*1..2]-(b:Entity)
        RETURN DISTINCT b.name AS name LIMIT 5
      $$) AS (name agtype);`
    );
    for (const row of traverse.rows) {
      console.log(`  ${row.name}`);
    }

  } catch (error) {
    console.error('迁移失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateToAGE();
