import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { aiConfigCache, updateAiConfig, resetAiConfig, PORT } from '../config.js';
import pool from '../db.js';

const router = express.Router();

/**
 * 获取用户自己的 AI 配置（不回退全局缓存）
 */
async function getUserConfig(userId) {
  if (!userId) return null;
  try {
    const result = await pool.query('SELECT * FROM user_ai_configs WHERE user_id = $1', [userId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (e) {
    console.error('获取用户 AI 配置失败:', e);
    return null;
  }
}

// 获取 AI 配置状态
// 未登录：返回默认值（configured=false），仅用于显示默认表单
// 已登录：返回用户自己的配置（configured 取决于是否有 api_key）
router.get('/config', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  let userId = null;
  let userConfig = null;

  if (token) {
    try {
      const jwt = await import('jsonwebtoken');
      const { JWT_SECRET } = await import('../config.js');
      const decoded = jwt.default.verify(token, JWT_SECRET);
      userId = decoded.id;
      userConfig = await getUserConfig(userId);
    } catch (e) {
      // token 无效或过期，忽略
    }
  }

  const hasOwnConfig = !!(userConfig && userConfig.api_key);

  res.json({
    configured: hasOwnConfig && !!userConfig.endpoint,
    endpoint: hasOwnConfig ? (userConfig.endpoint || '') : '',
    model: hasOwnConfig ? (userConfig.model || 'glm-4-flash') : 'glm-4-flash',
    temperature: parseFloat(hasOwnConfig ? (userConfig.temperature || 0.7) : 0.7),
    maxTokens: parseInt(hasOwnConfig ? (userConfig.max_tokens || 16384) : 16384),
    useTemperature: hasOwnConfig ? (userConfig.use_temperature !== undefined ? userConfig.use_temperature : true) : true,
    useMaxTokens: hasOwnConfig ? (userConfig.use_max_tokens !== undefined ? userConfig.use_max_tokens : true) : true,
    embeddingConfigured: hasOwnConfig && !!userConfig.embedding_endpoint,
    embeddingEndpoint: hasOwnConfig ? (userConfig.embedding_endpoint || '') : '',
    embeddingModel: hasOwnConfig ? (userConfig.embedding_model || 'embedding-2') : 'embedding-2',
    apiKeyMasked: hasOwnConfig && userConfig.api_key
      ? `${userConfig.api_key.slice(0, 3)}***${userConfig.api_key.slice(-4)}`
      : '',
  });
});

// 保存 AI 配置（需要登录）
router.post('/config', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { endpoint, apiKey, model, temperature, maxTokens, useTemperature, useMaxTokens, embeddingEndpoint, embeddingModel } = req.body;

  try {
    // 先检查是否已有配置
    const existing = await pool.query('SELECT id FROM user_ai_configs WHERE user_id = $1', [userId]);

    if (existing.rows.length > 0) {
      // 更新
      await pool.query(
        `UPDATE user_ai_configs SET
          endpoint = COALESCE($1, endpoint),
          api_key = COALESCE($2, api_key),
          model = COALESCE($3, model),
          temperature = COALESCE($4, temperature),
          max_tokens = COALESCE($5, max_tokens),
          use_temperature = COALESCE($6, use_temperature),
          use_max_tokens = COALESCE($7, use_max_tokens),
          embedding_endpoint = COALESCE($8, embedding_endpoint),
          embedding_model = COALESCE($9, embedding_model),
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $10`,
        [endpoint || null, apiKey || null, model, temperature, maxTokens, useTemperature, useMaxTokens, embeddingEndpoint || null, embeddingModel, userId]
      );
    } else {
      // 插入
      await pool.query(
        `INSERT INTO user_ai_configs
          (user_id, endpoint, api_key, model, temperature, max_tokens, use_temperature, use_max_tokens, embedding_endpoint, embedding_model)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [userId, endpoint || '', apiKey || '', model || 'glm-4-flash', temperature || 0.7, maxTokens || 16384, useTemperature !== false, useMaxTokens !== false, embeddingEndpoint || '', embeddingModel || 'embedding-2']
      );
    }

    // 获取更新后的配置用于返回
    const result = await pool.query('SELECT * FROM user_ai_configs WHERE user_id = $1', [userId]);
    const cfg = result.rows[0];

    res.json({
      success: true,
      configured: !!(cfg.api_key && cfg.endpoint),
      embeddingConfigured: !!(cfg.api_key && cfg.embedding_endpoint),
      apiKeyMasked: cfg.api_key
        ? `${cfg.api_key.slice(0, 3)}***${cfg.api_key.slice(-4)}`
        : '',
    });
  } catch (error) {
    console.error('保存 AI 配置失败:', error);
    res.status(500).json({ error: '保存配置失败: ' + error.message });
  }
});

// 删除 AI 配置（需要登录）
router.delete('/config', authMiddleware, async (req, res) => {
  const userId = req.user.id;

  try {
    await pool.query('DELETE FROM user_ai_configs WHERE user_id = $1', [userId]);
    res.json({ success: true });
  } catch (error) {
    console.error('删除 AI 配置失败:', error);
    res.status(500).json({ error: '删除配置失败' });
  }
});

// AI 代理请求
router.post('/proxy', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const userConfig = await getUserConfig(userId);

  // 只用用户自己的配置
  const apiKey = userConfig?.api_key || req.body.apiKey;
  const endpoint = userConfig?.endpoint || req.body.endpoint;
  const model = userConfig?.model || req.body.model || 'glm-4-flash';
  const temperature = req.body.temperature ?? userConfig?.temperature ?? 0.7;
  const maxTokens = req.body.maxTokens ?? userConfig?.max_tokens ?? 4096;
  const useTemperature = req.body.useTemperature ?? userConfig?.use_temperature ?? true;
  const useMaxTokens = req.body.useMaxTokens ?? userConfig?.use_max_tokens ?? true;
  const messages = req.body.messages;

  if (!apiKey || !endpoint) {
    return res.status(400).json({ error: '请先配置 AI API' });
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages 是必需的' });
  }

  try {
    const requestBody = {
      model: model || 'glm-4-flash',
      messages: messages,
    };

    if (useTemperature !== false) {
      requestBody.temperature = temperature || 0.7;
    }
    if (useMaxTokens !== false) {
      requestBody.max_tokens = maxTokens || 4096;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `API 错误: ${errorText}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('AI Proxy Error:', error.message);
    res.status(500).json({ error: `代理请求失败: ${error.message}` });
  }
});

// 嵌入生成API
router.post('/embedding', async (req, res) => {
  const { texts } = req.body;

  if (!texts || !Array.isArray(texts)) {
    return res.status(400).json({ error: 'texts 数组是必需的' });
  }

  if (!aiConfigCache.apiKey && !aiConfigCache.api_key) {
    return res.status(400).json({ error: '请先配置嵌入模型API' });
  }

  try {
    const response = await fetch(aiConfigCache.embeddingEndpoint || aiConfigCache.embedding_endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfigCache.apiKey || aiConfigCache.api_key}`,
      },
      body: JSON.stringify({
        model: aiConfigCache.embeddingModel || aiConfigCache.embedding_model || 'text-embedding-v3',
        input: texts,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `嵌入API错误: ${errorText}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Embedding Error:', error.message);
    res.status(500).json({ error: `嵌入生成失败: ${error.message}` });
  }
});

export default router;
