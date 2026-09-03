import https from 'https';
import { aiConfigCache } from './config.js';

const body = JSON.stringify({
  model: 'glm-4-flash',
  messages: [
    { role: 'system', content: '你是一个分析助手。' },
    { role: 'user', content: '海珠湿地' }
  ],
  temperature: 0.7,
  max_tokens: 16384,
});

console.log(`请求体: ${(body.length/1024).toFixed(1)}KB`);

const httpsAgent = new https.Agent({ keepAlive: true, timeout: 600000 });

const start = Date.now();
const req = https.request('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
  method: 'POST',
  agent: httpsAgent,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${aiConfigCache.apiKey}`,
  },
  timeout: 60000,
}, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log(`HTTP ${res.statusCode}, 耗时: ${Date.now()-start}ms`);
    try {
      const parsed = JSON.parse(data);
      console.log(`响应: ${parsed.choices?.[0]?.message?.content?.slice(0, 80)}...`);
    } catch(e) {
      console.log(`解析失败: ${data.slice(0, 200)}`);
    }
    process.exit(0);
  });
});

req.on('error', e => { console.log(`错误: ${e.message}`); process.exit(1); });
req.on('timeout', () => { req.destroy(); console.log('超时'); process.exit(1); });
req.write(body);
req.end();
