import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  agentSessions,
  getAgentMeta,
  buildAgentContext,
  buildSystemPrompt,
  callAI,
  callAIStream,
  parseAgentOutput,
  touchSession
} from '../services/agent.js';
import pool from '../db.js';

const router = express.Router();

// 异步保存聊天记录（不阻塞响应）
async function saveChatHistory(userId, agentName, sessionId, userInput, response) {
  try {
    await Promise.all([
      pool.query(
        'INSERT INTO chat_history (user_id, agent_name, session_id, role, content) VALUES ($1, $2, $3, $4, $5)',
        [userId, agentName, sessionId, 'user', userInput]
      ),
      pool.query(
        'INSERT INTO chat_history (user_id, agent_name, session_id, role, content) VALUES ($1, $2, $3, $4, $5)',
        [userId, agentName, sessionId, 'assistant', response]
      )
    ]);
  } catch (e) {
    console.error('保存聊天记录失败:', e);
  }
}

// 异步更新会话元数据（不阻塞响应）
async function updateSessionMeta(userId, agentName, sessionId, userInput) {
  try {
    const existing = await pool.query('SELECT 1 FROM chat_sessions WHERE session_id = $1', [sessionId]);
    if (existing.rows.length === 0) {
      const title = userInput.substring(0, 50) + (userInput.length > 50 ? '...' : '');
      await pool.query(
        'INSERT INTO chat_sessions (user_id, agent_name, session_id, title) VALUES ($1, $2, $3, $4)',
        [userId, agentName, sessionId, title]
      );
    } else {
      await pool.query(
        'UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE session_id = $1',
        [sessionId]
      );
    }
  } catch (e) {
    console.error('更新会话元数据失败:', e);
  }
}

// AI 对话 API (Graph-RAG) - 简单模拟
router.post('/chat', async (req, res) => {
  const { message, context } = req.body;
  res.json({
    response: `收到你的问题：${message}。\n\n这是 Graph-RAG 模拟响应。后续将接入真实的 AI API，结合知识图谱数据进行智能回答。`
  });
});

// 获取所有 Agent
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, display_name, description, context_type, supports_multi_turn, output_format FROM agent_meta ORDER BY id');
    res.json({ agents: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个 Agent 详情
router.get('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const result = await pool.query('SELECT * FROM agent_meta WHERE name = $1', [name]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json({ agent: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agent 执行 API
router.post('/:name/invoke', authMiddleware, async (req, res) => {
  const { name } = req.params;
  const { session_id, user_input, context } = req.body;
  const userId = req.user.id;

  if (!user_input) {
    return res.status(400).json({ error: 'user_input 是必需的' });
  }

  try {
    // 获取用户 AI 配置
    let userConfig = null;
    try {
      const cfgResult = await pool.query('SELECT * FROM user_ai_configs WHERE user_id = $1', [userId]);
      if (cfgResult.rows.length > 0) {
        userConfig = cfgResult.rows[0];
      }
    } catch (e) {
      console.error('获取用户 AI 配置失败:', e);
    }

    // 使用缓存的 Agent 元数据
    const agent = await getAgentMeta(name);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const fullContext = await buildAgentContext(name, context, user_input);

    let session = session_id ? agentSessions.get(session_id) : null;
    let newSessionId = session_id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (!session && agent.supports_multi_turn) {
      session = {
        agentName: name,
        messages: [],
        createdAt: new Date(),
        lastActive: Date.now()
      };
      agentSessions.set(newSessionId, session);
    }

    // 会话清理定时器已在 server/index.js 启动时初始化，无需重复调用

    let messages = [];
    if (agent.supports_multi_turn && session) {
      messages = [...session.messages];
      touchSession(newSessionId);
    }
    messages.push({ role: 'user', content: user_input });

    const systemPrompt = buildSystemPrompt(agent, fullContext);

    const aiResponse = await callAI(systemPrompt, messages, agent, userConfig);

    const output = parseAgentOutput(aiResponse, agent.output_format);

    if (agent.supports_multi_turn && session) {
      session.messages.push({ role: 'user', content: user_input });
      session.messages.push({ role: 'assistant', content: aiResponse });
      touchSession(newSessionId);
    }

    // 异步保存聊天记录和会话元数据（不阻塞响应）
    saveChatHistory(userId, name, newSessionId, user_input, aiResponse).catch(e => console.error('保存聊天记录失败:', e));
    updateSessionMeta(userId, name, newSessionId, user_input).catch(e => console.error('更新会话元数据失败:', e));

    const response = {
      session_id: agent.supports_multi_turn ? newSessionId : null,
      output,
      raw_response: aiResponse
    };

    if (name === 'analysis_assistant' && fullContext.rag_context) {
      response.rag_context = fullContext.rag_context;
    }

    res.json(response);
  } catch (error) {
    console.error('Agent invoke error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 流式调用 Agent (SSE)
router.post('/:name/invoke/stream', authMiddleware, async (req, res) => {
  const { name } = req.params;
  const { session_id, user_input, context } = req.body;
  const userId = req.user.id;

  if (!user_input) {
    return res.status(400).json({ error: 'user_input 是必需的' });
  }

  // 获取用户 AI 配置
  let userConfig = null;
  try {
    const cfgResult = await pool.query('SELECT * FROM user_ai_configs WHERE user_id = $1', [userId]);
    if (cfgResult.rows.length > 0) {
      userConfig = cfgResult.rows[0];
    }
  } catch (e) {
    console.error('获取用户 AI 配置失败:', e);
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    // 使用缓存的 Agent 元数据
    const agent = await getAgentMeta(name);
    if (!agent) {
      res.write(`data: ${JSON.stringify({ error: 'Agent not found' })}\n\n`);
      res.end();
      return;
    }

    const fullContext = await buildAgentContext(name, context, user_input);

    let session = session_id ? agentSessions.get(session_id) : null;
    let newSessionId = session_id || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    res.write(`data: ${JSON.stringify({ type: 'session_id', session_id: newSessionId })}\n\n`);

    // 会话清理定时器已在 server/index.js 启动时初始化

    let messages = [];
    if (agent.supports_multi_turn && session) {
      messages = [...session.messages];
      touchSession(newSessionId);
    }
    messages.push({ role: 'user', content: user_input });

    const systemPrompt = buildSystemPrompt(agent, fullContext);

    let fullResponse = '';
    await callAIStream(systemPrompt, messages, agent, (chunk) => {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
    }, userConfig);

    // 解析输出
    const output = parseAgentOutput(fullResponse, agent.output_format);

    res.write(`data: ${JSON.stringify({ type: 'done', full_response: fullResponse, output })}\n\n`);

    if (agent.supports_multi_turn && session) {
      session.messages.push({ role: 'user', content: user_input });
      session.messages.push({ role: 'assistant', content: fullResponse });
      touchSession(newSessionId);
    }

    // 异步保存（不阻塞）
    saveChatHistory(userId, name, newSessionId, user_input, fullResponse).catch(e => console.error('保存聊天记录失败:', e));
    updateSessionMeta(userId, name, newSessionId, user_input).catch(e => console.error('更新会话元数据失败:', e));

    res.end();
  } catch (error) {
    console.error('Agent stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// 清除 Agent 会话
router.delete('/:name/sessions/:sessionId', authMiddleware, async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user.id;

  agentSessions.delete(sessionId);

  await pool.query('DELETE FROM chat_history WHERE session_id = $1 AND user_id = $2', [sessionId, userId]);
  await pool.query('DELETE FROM chat_sessions WHERE session_id = $1 AND user_id = $2', [sessionId, userId]);

  res.json({ success: true });
});

export default router;