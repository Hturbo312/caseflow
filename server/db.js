import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  database: process.env.DB_NAME || 'knowledge_graph',
  host: process.env.DB_HOST || '/var/run/postgresql',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  max: 20,                         // 最大连接数
  idleTimeoutMillis: 30000,        // 空闲连接 30s 后回收
  connectionTimeoutMillis: 10000,  // 连接超时 10s
});

// 连接池错误处理：防止未捕获的异常导致进程崩溃
pool.on('error', (err) => {
  console.error('[db] 连接池异常:', err.message);
});

// 验证数据库连通性（启动时）
pool.query('SELECT 1')
  .then(() => console.log('[db] 数据库连接验证成功'))
  .catch(err => console.error('[db] 数据库连接验证失败:', err.message));

export default pool;
