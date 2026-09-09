import express from 'express';
import cors from 'cors';
import compression from 'compression';
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
import evidenceRoutes from './routes/evidence.js';
import compareRoutes from './routes/compare.js';
import reviewRoutes from './routes/review.js';
import schemaVersionsRoutes from './routes/schemaVersions.js';
import conceptsRoutes from './routes/concepts.js';
import researchRoutes, { initializeResearch } from './routes/research.js';
import agentToolsRoutes from './routes/agentTools.js';
import researchWorkspaceRoutes from './routes/researchWorkspace.js';
import { initializeResearchJobs } from './services/researchWorker.js';

dotenv.config();

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
// gzip 压缩 JSON 响应（/api/cases 响应体大，压缩后传输量降 ~85%）。
// 必须跳过 SSE 流式响应，否则 res.write 的分块会被缓冲住，前端打字机效果失效
app.use(compression({
  filter: (req, res) => {
    if ((res.getHeader('Content-Type') || '').includes('text/event-stream')) return false;
    return compression.filter(req, res);
  }
}));

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
app.use('/api/evidence', evidenceRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api/review', reviewRoutes);
app.use('/api', schemaVersionsRoutes);
app.use('/api/concepts', conceptsRoutes);
app.use('/api/research', researchRoutes);
app.use('/api/research-workspace', researchWorkspaceRoutes);
app.use('/api/agent-tools', agentToolsRoutes);

// 启动服务器 - 设置较长超时（LLM 调用较慢）
const server = app.listen(PORT, '0.0.0.0', async () => {
  await initializeDatabase();
  await initializeResearch();
  await initializeResearchJobs();
  startSessionCleanup(); // 启动会话清理定时器（只需一次）
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Database: ${process.env.DB_NAME}`);
});
// 禁用默认服务器超时（Node.js 默认 120s，LLM 调用需要更久）
server.timeout = 0;
server.keepAliveTimeout = 660000;
server.headersTimeout = 670000;

// 优雅关闭：释放数据库连接池，5秒强杀防止僵尸进程
let isShuttingDown = false;
const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[server] ${signal} 收到，正在关闭...`);
  // 5秒后强制退出，防止 keepalive 连接阻止进程退出
  setTimeout(() => { console.log('[server] 强制退出'); process.exit(1); }, 5000);
  pool.end().then(() => {
    server.close(() => process.exit(0));
  }).catch(() => {
    process.exit(0);
  });
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
