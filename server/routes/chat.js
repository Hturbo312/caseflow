import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';

const router = express.Router();

// Demo session — visible to all users (including unauthenticated)
const DEMO_SESSION_PREFIX = 'demo-graphrag-analysis';

// 可选认证的中间件：有 token 就解析，没有就跳过
function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      // token 无效就当作未登录
    }
  }
  next();
}

// 获取会话列表：已登录 → 用户会话 + demo；未登录 → 仅 demo
router.get('/sessions', optionalAuth, async (req, res) => {
  const userId = req.user?.id;
  const { agent_name } = req.query;

  try {
    let query = `
      SELECT cs.*, am.display_name as agent_display_name
      FROM chat_sessions cs
      LEFT JOIN agent_meta am ON cs.agent_name = am.name
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (userId) {
      query += ` AND (cs.user_id = $${idx} OR cs.session_id LIKE '${DEMO_SESSION_PREFIX}%')`;
      params.push(userId);
      idx++;
    } else {
      query += ` AND cs.session_id LIKE '${DEMO_SESSION_PREFIX}%'`;
    }

    if (agent_name) {
      query += ` AND cs.agent_name = $${idx}`;
      params.push(agent_name);
      idx++;
    }

    query += ' ORDER BY cs.updated_at DESC LIMIT 50';

    const result = await pool.query(query, params);
    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    res.status(500).json({ error: '获取会话列表失败' });
  }
});

// 获取特定会话的聊天历史：demo 会话允许未登录访问
router.get('/sessions/:sessionId/history', optionalAuth, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user?.id;
  const isDemo = sessionId.startsWith(DEMO_SESSION_PREFIX);

  try {
    if (isDemo) {
      // Demo 会话：任何人可访问，统一从原始 demo 数据读取
      const result = await pool.query(
        `SELECT id, agent_name, $1 as session_id, role, content, created_at
         FROM chat_history
         WHERE session_id = 'demo-graphrag-analysis-2026' AND user_id = 1
         ORDER BY id ASC`,
        [sessionId]
      );
      return res.json({ messages: result.rows });
    }

    // 非 demo 会话：必须登录
    if (!userId) {
      return res.status(401).json({ error: '未登录', requireAuth: true });
    }

    const result = await pool.query(
      'SELECT * FROM chat_history WHERE session_id = $1 AND user_id = $2 ORDER BY created_at ASC',
      [sessionId, userId]
    );
    res.json({ messages: result.rows });
  } catch (error) {
    console.error('获取聊天历史失败:', error);
    res.status(500).json({ error: '获取聊天历史失败' });
  }
});

// 更新会话标题（仅登录用户）
router.put('/sessions/:sessionId/title', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;
  const { title } = req.body;
  const userId = req.user.id;

  try {
    await pool.query(
      'UPDATE chat_sessions SET title = $1, updated_at = CURRENT_TIMESTAMP WHERE session_id = $2 AND user_id = $3',
      [title, sessionId, userId]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('更新会话标题失败:', error);
    res.status(500).json({ error: '更新会话标题失败' });
  }
});

export default router;