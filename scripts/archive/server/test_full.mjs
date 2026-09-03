import pool from './db.js';
import { buildAgentContext, buildSystemPrompt, callAI, getAgentMeta } from './services/agent.js';
import { aiConfigCache } from './config.js';

const start = Date.now();
console.log(`[${Date.now()-start}ms] 开始`);

// 1. buildAgentContext
console.log(`[${Date.now()-start}ms] 开始 buildAgentContext`);
const ctx = await buildAgentContext('analysis_assistant', { schema_id: 3 }, "海珠湿地");
console.log(`[${Date.now()-start}ms] 完成 buildAgentContext`);

// 2. buildSystemPrompt
console.log(`[${Date.now()-start}ms] 开始 buildSystemPrompt`);
const agent = await getAgentMeta('analysis_assistant');
const systemPrompt = buildSystemPrompt(agent, ctx);
console.log(`[${Date.now()-start}ms] 完成 buildSystemPrompt (长度: ${systemPrompt.length} 字符)`);

// 3. callAI
console.log(`[${Date.now()-start}ms] 开始 callAI`);
const userConfig = {
  apiKey: aiConfigCache.apiKey,
  endpoint: aiConfigCache.endpoint,
  model: aiConfigCache.model,
  temperature: 0.7,
  maxTokens: 16384,
  useTemperature: true,
  useMaxTokens: true,
};
const response = await callAI(systemPrompt, [{role: 'user', content: "海珠湿地"}], agent, userConfig, 1);
console.log(`[${Date.now()-start}ms] 完成 callAI`);
console.log(`响应前100字: ${response.slice(0, 100)}...`);

pool.end();
