import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// 获取用户的会话列表
router.get('/sessions', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { agent_name } = req.query;

  try {
    let query = `
      SELECT cs.*, am.display_name as agent_display_name
      FROM chat_sessions cs
      LEFT JOIN agent_meta am ON cs.agent_name = am.name
      WHERE cs.user_id = $1
    `;
    const params = [userId];

    if (agent_name) {
      query += ' AND cs.agent_name = $2';
      params.push(agent_name);
    }

    query += ' ORDER BY cs.updated_at DESC LIMIT 50';

    const result = await pool.query(query, params);
    res.json({ sessions: result.rows });
  } catch (error) {
    console.error('获取会话列表失败:', error);
    res.status(500).json({ error: '获取会话列表失败' });
  }
});

// 获取特定会话的聊天历史
router.get('/sessions/:sessionId/history', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  try {
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

// 更新会话标题
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