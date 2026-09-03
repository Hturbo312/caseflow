import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  database: process.env.DB_NAME || 'knowledge_graph',
  host: process.env.DB_HOST || '/var/run/postgresql',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  max: 20,                              // 最大连接数
  idleTimeoutMillis: 600_000,           // 空闲连接 10 分钟后回收（避免频繁创建/销毁）
  connectionTimeoutMillis: 10_000,      // 连接超时 10s
  statement_timeout: 30_000,            // 单条 SQL 最长执行 30s
  maxLifetime: 1_800_000,               // 连接最长存活 30 分钟，强制轮换防止僵尸连接
  allowExitOnIdle: true,                // 空闲时允许进程正常退出
});

// 连接池错误处理：防止未捕获的异常导致进程崩溃
// idle 连接上的错误（如 PostgreSQL 服务端断开）不会导致查询失败，
// pg 会自动移除坏连接并创建新连接
pool.on('error', (err) => {
  console.error('[db] 连接池异常（非致命，连接池自动恢复）:', err.message);
});

// 验证数据库连通性 + 序列健康检查（启动时）
pool.query('SELECT 1')
  .then(async () => {
    console.log('[db] 数据库连接验证成功');
    // 检查序列是否与表数据同步，防止 duplicate key 错误
    try {
      const { rows } = await pool.query(`
        SELECT 'case_entities_id_seq' AS seq
        WHERE (SELECT last_value FROM case_entities_id_seq) < (SELECT COALESCE(MAX(id), 0) FROM case_entities)
      `);
      if (rows.length > 0) {
        console.warn('[db] ⚠️ case_entities 序列落后于数据，正在修复...');
        await pool.query(`SELECT setval('case_entities_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM case_entities))`);
        console.log('[db] ✓ case_entities 序列已修复');
      }
      // 同样检查 case_relations 序列
      const relRows = await pool.query(`
        SELECT 'case_relations_id_seq' AS seq
        WHERE (SELECT last_value FROM case_relations_id_seq) < (SELECT COALESCE(MAX(id), 0) FROM case_relations)
      `);
      if (relRows.rows.length > 0) {
        console.warn('[db] ⚠️ case_relations 序列落后于数据，正在修复...');
        await pool.query(`SELECT setval('case_relations_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM case_relations))`);
        console.log('[db] ✓ case_relations 序列已修复');
      }
    } catch (e) {
      console.error('[db] 序列检查失败:', e.message);
    }
  })
  .catch(err => console.error('[db] 数据库连接验证失败:', err.message));

export default pool;
