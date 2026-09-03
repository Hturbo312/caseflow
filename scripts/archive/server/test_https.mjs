import https from 'https';

const body = JSON.stringify({
  model: 'glm-4-flash',
  messages: [{ role: 'user', content: '请用一句话介绍海珠湿地' }],
  max_tokens: 50,
});

console.log('=== 不使用keep-alive agent ===');
const start = Date.now();

const req = https.request('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
  method: 'POST',
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
      console.log(`解析失败: ${data.slice(0, 200)}`);
    }
  });
});

req.on('error', e => console.log(`错误: ${e.message}`));
req.on('timeout', () => { req.destroy(); console.log('超时'); });
req.write(body);
req.end();
