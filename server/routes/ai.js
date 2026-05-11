import express from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { aiConfigCache, updateAiConfig, resetAiConfig, PORT } from '../config.js';

const router = express.Router();

// 获取 AI 配置状态
router.get('/config', (req, res) => {
  res.json({
    configured: !!(aiConfigCache.apiKey && aiConfigCache.endpoint),
    endpoint: aiConfigCache.endpoint,
    model: aiConfigCache.model,
    temperature: aiConfigCache.temperature,
    maxTokens: aiConfigCache.maxTokens,
    useTemperature: aiConfigCache.useTemperature,
    useMaxTokens: aiConfigCache.useMaxTokens,
    embeddingConfigured: !!(aiConfigCache.apiKey && aiConfigCache.embeddingEndpoint),
    embeddingEndpoint: aiConfigCache.embeddingEndpoint,
    embeddingModel: aiConfigCache.embeddingModel,
    apiKeyMasked: aiConfigCache.apiKey
      ? `${aiConfigCache.apiKey.slice(0, 3)}***${aiConfigCache.apiKey.slice(-4)}`
      : '',
  });
});

// 保存 AI 配置
router.post('/config', authMiddleware, (req, res) => {
  const { endpoint, apiKey, model, temperature, maxTokens, useTemperature, useMaxTokens, embeddingEndpoint, embeddingModel } = req.body;

  updateAiConfig({
    apiKey, endpoint, model, temperature, maxTokens, useTemperature, useMaxTokens, embeddingEndpoint, embeddingModel
  });

  res.json({
    success: true,
    configured: !!(aiConfigCache.apiKey && aiConfigCache.endpoint),
    embeddingConfigured: !!(aiConfigCache.apiKey && aiConfigCache.embeddingEndpoint),
    apiKeyMasked: aiConfigCache.apiKey
      ? `${aiConfigCache.apiKey.slice(0, 3)}***${aiConfigCache.apiKey.slice(-4)}`
      : '',
  });
});

// 删除 AI 配置
router.delete('/config', authMiddleware, (req, res) => {
  resetAiConfig();
  res.json({ success: true });
});

// AI 代理请求
router.post('/proxy', authMiddleware, async (req, res) => {
  const endpoint = req.body.endpoint || aiConfigCache.endpoint;
  const apiKey = req.body.apiKey || aiConfigCache.apiKey;
  const model = req.body.model || aiConfigCache.model;
  const temperature = req.body.temperature ?? aiConfigCache.temperature;
  const maxTokens = req.body.maxTokens ?? aiConfigCache.maxTokens;
  const useTemperature = req.body.useTemperature ?? aiConfigCache.useTemperature;
  const useMaxTokens = req.body.useMaxTokens ?? aiConfigCache.useMaxTokens;
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

  if (!aiConfigCache.apiKey || !aiConfigCache.embeddingEndpoint) {
    return res.status(400).json({ error: '请先配置嵌入模型API' });
  }

  try {
    const response = await fetch(aiConfigCache.embeddingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${aiConfigCache.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfigCache.embeddingModel || 'text-embedding-v3',
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