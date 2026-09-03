import pool from './db.js';
import { buildAgentContext, buildSystemPrompt, getAgentMeta } from './services/agent.js';
import { aiConfigCache } from './config.js';
import https from 'https';

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
console.log(`[${Date.now()-start}ms] 开始调用智谱API`);

const apiStart = Date.now();
const req = https.request('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aiConfigCache.apiKey}`,
    'Content-Length': Buffer.byteLength(body)
  },
  timeout: 60000
}, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log(`[${Date.now()-start}ms] API响应 (HTTP ${res.statusCode}), 耗时: ${Date.now()-apiStart}ms`);
    if (res.statusCode === 200) {
      try {
        const parsed = JSON.parse(data);
        console.log(`响应: ${parsed.choices?.[0]?.message?.content?.slice(0, 100)}...`);
      } catch(e) {
        console.log(`JSON解析失败: ${e.message}`);
        console.log(`响应前200字: ${data.slice(0, 200)}`);
      }
    } else {
      console.log(`错误: ${data.slice(0, 300)}`);
    }
    pool.end();
  });
});

req.on('error', (e) => {
  console.log(`[${Date.now()-start}ms] 请求错误: ${e.message}`);
  pool.end();
});

req.on('timeout', () => {
  req.destroy();
  console.log(`[${Date.now()-start}ms] 请求超时`);
  pool.end();
});

req.write(body);
req.end();
