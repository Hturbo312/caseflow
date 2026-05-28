import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { PORT } from './config.js';
import { initializeDatabase } from './init.js';

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
app.use(express.json());

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
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Database: ${process.env.DB_NAME}`);
});
// 禁用默认服务器超时（Node.js 默认 120s，LLM 调用需要更久）
server.timeout = 0;
server.keepAliveTimeout = 660000;
server.headersTimeout = 670000;