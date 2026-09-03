import pool from './db.js';
import { buildAgentContext, buildSystemPrompt, getAgentMeta } from './services/agent.js';
import { aiConfigCache } from './config.js';

const start = Date.now();
console.log(`[${Date.now()-start}ms] 开始`);

const ctx = await buildAgentContext('analysis_assistant', { schema_id: 3 }, "海珠湿地");
const agent = await getAgentMeta('analysis_assistant');
const systemPrompt = buildSystemPrompt(agent, ctx);

const messages = [{role: 'user', content: "海珠湿地"}];
const requestBody = {
  model: 'glm-4-flash',
  messages: [
    { role: 'system', content: systemPrompt },
    ...messages
  ],
  temperature: 0.7,
  max_tokens: 16384,
};

const body = JSON.stringify(requestBody);
console.log(`[${Date.now()-start}ms] 请求体大小: ${(body.length / 1024).toFixed(1)} KB`);
console.log(`[${Date.now()-start}ms] 开始调用智谱API (fetch)`);

const apiStart = Date.now();
try {
  const res = await fetch(aiConfigCache.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${aiConfigCache.apiKey}`,
    },
    body: body,
    signal: AbortSignal.timeout(60000),
  });
  
  console.log(`[${Date.now()-start}ms] API响应 (HTTP ${res.status}), 耗时: ${Date.now()-apiStart}ms`);
  
  if (res.ok) {
    const data = await res.json();
    console.log(`响应: ${data.choices?.[0]?.message?.content?.slice(0, 100)}...`);
  } else {
    const text = await res.text();
    console.log(`错误: ${text.slice(0, 300)}`);
  }
} catch(e) {
  console.log(`[${Date.now()-start}ms] fetch错误: ${e.message}`);
}

pool.end();
