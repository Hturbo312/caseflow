import https from 'https';
import http from 'http';

const body = JSON.stringify({
  model: 'glm-4-flash',
  messages: [{ role: 'user', content: '请用一句话介绍海珠湿地' }],
  max_tokens: 50,
});

// 创建keep-alive agent（和agent.js一样的配置）
const httpsAgent = new https.Agent({ keepAlive: true, timeout: 600000 });

console.log('=== 使用 keep-alive agent ===');
const start = Date.now();

const req = https.request('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
  method: 'POST',
  agent: httpsAgent,
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer a67b373b301b4ed1a2c23c23bfc8532f.kiX3RuMh56HHkgeY',
  },
  timeout: 60000,
}, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    console.log(`HTTP ${res.statusCode}, 耗时: ${Date.now()-start}ms`);
    try {
      const parsed = JSON.parse(data);
      console.log(`响应: ${parsed.choices?.[0]?.message?.content}`);
    } catch(e) {
      console.log(`解析失败`);
    }
    process.exit(0);
  });
});

req.on('error', e => { console.log(`错误: ${e.message}`); process.exit(1); });
req.on('timeout', () => { req.destroy(); console.log('超时'); process.exit(1); });
req.write(body);
req.end();
