import { readFile } from 'node:fs/promises';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config.js';
const fixture = JSON.parse(await readFile('/tmp/caseflow-review-fixture.json', 'utf8'));
const token = jwt.sign({ id: fixture.userId, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
const base = `http://127.0.0.1:3301/api/research-workspace/${fixture.caseId}`;
for (const name of ['research-sample.pdf', 'research-sample.docx']) {
  const response = await fetch(base + '/materials', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name, base64: (await readFile('../testdata/' + name)).toString('base64') }) });
  if (!response.ok) throw new Error(await response.text());
}
const text = Array.from({ length: 10 }, (_, i) => `第${i + 1}阶段记录：社区工作人员整理居民反馈，核对平台提示，并开展电话核查。${'研究材料记录了参与主体、具体行动和后续回访；现有记录没有说明的结果应当作为证据缺口保留，不把技术配置直接解释为改善效果。'.repeat(4)}`).join('\n\n');
await fetch(base + '/materials', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '长篇过程材料.md', text }) });
for (let i = 0; i < 120; i++) {
  const state = await (await fetch(base, { headers: { Authorization: `Bearer ${token}` } })).json();
  if (state.jobs[0]?.status === 'failed') throw new Error(state.jobs[0].error);
  if (state.jobs[0]?.status === 'completed' && state.data.drafts.at(-1)?.sourceIds?.length >= 6) {
    console.log(JSON.stringify({ sources: state.data.sources.map(s => ({ title: s.title, status: s.status, error: s.error })), paragraphs: state.data.drafts.at(-1).paragraphs.length }));
    break;
  }
  await new Promise(r => setTimeout(r, 1000));
}
