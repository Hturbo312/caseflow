import https from 'https';
import { aiConfigCache } from './config.js';

const body = JSON.stringify({
  model: 'glm-4-flash',
  messages: [{ role: 'user', content: '你好' }],
  max_tokens: 10,
});

console.log('=== Node.js https 详细计时 ===');

const url = new URL('https://open.bigmodel.cn/api/paas/v4/chat/completions');

const dnsStart = Date.now();
const dns = await new Promise((resolve) => {
  require('dns').lookup(url.hostname, (err, address) => {
    console.log(`DNS: ${Date.now()-dnsStart}ms (${address})`);
    resolve(address);
  });
});

const tcpStart = Date.now();
const socket = require('net').connect(443, dns, () => {
  console.log(`TCP: ${Date.now()-tcpStart}ms`);
  socket.destroy();
  runTest();
});

async function runTest() {
  const httpsAgent = new https.Agent({ keepAlive: true, timeout: 600000 });
  
  const reqStart = Date.now();
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
      console.log(`总耗时: ${Date.now()-reqStart}ms, HTTP ${res.statusCode}`);
      process.exit(0);
    });
  });
  
  req.on('error', e => { console.log(`错误: ${e.message}`); process.exit(1); });
  req.on('timeout', () => { req.destroy(); console.log('超时'); process.exit(1); });
  req.write(body);
  req.end();
}
