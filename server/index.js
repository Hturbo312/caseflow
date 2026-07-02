import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import pool from './db.js';
import { PORT } from './config.js';
import { initializeDatabase } from './init.js';
import { startSessionCleanup } from './services/agent.js';

// 路由模块
import authRoutes from './routes/auth.js';
import schemasRoutes from './routes/schemas.js';
import casesRoutes from './routes/cases.js';
import graphsRoutes from './routes/graphs.js';
import agentsRoutes from './routes/agents.js';
import chatRoutes from './routes/chat.js';
import aiRoutes from './routes/ai.js';
import ragRoutes from './routes/rag.js';
import graphRagRoutes from './routes/graphRag.js';
import extractionRoutes from './routes/extraction.js';

dotenv.config();

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 注册路由
app.use('/api/auth', authRoutes);
app.use('/api/schemas', schemasRoutes);
app.use('/api/cases', casesRoutes);
app.use('/api/graphs', graphsRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/graph-rag', graphRagRoutes);
app.use('/api/extraction', extractionRoutes);

// 启动服务器 - 设置较长超时（LLM 调用较慢）
const server = app.listen(PORT, '0.0.0.0', async () => {
  await initializeDatabase();
  startSessionCleanup(); // 启动会话清理定时器（只需一次）
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Database: ${process.env.DB_NAME}`);
});
// 禁用默认服务器超时（Node.js 默认 120s，LLM 调用需要更久）
server.timeout = 0;
server.keepAliveTimeout = 660000;
server.headersTimeout = 670000;

// 优雅关闭：释放数据库连接池，防止连接残留
process.on('SIGTERM', async () => {
  console.log('[server] SIGTERM 收到，正在关闭...');
  await pool.end();
  server.close(() => process.exit(0));
});
process.on('SIGINT', async () => {
  console.log('[server] SIGINT 收到，正在关闭...');
  await pool.end();
  server.close(() => process.exit(0));
});