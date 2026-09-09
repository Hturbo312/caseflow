// Isolated review harness: synthetic cases only, local mock model, loopback HTTP.
import express from 'express';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'node:path';
import { writeFile, rm, readFile } from 'node:fs/promises';
import pool from '../db.js';
import { JWT_SECRET } from '../config.js';
import researchRoutes, { initializeResearch } from '../routes/research.js';
import workspaceRoutes from '../routes/researchWorkspace.js';
import { initializeResearchJobs } from '../services/researchWorker.js';
import { MATERIAL_ROOT } from '../services/researchFiles.js';

await initializeResearch();
await initializeResearchJobs();
let failModel = false;
const mock = express(); mock.use(express.json({ limit: '10mb' }));
mock.post('/', (req, res) => {
  if (failModel) return res.status(503).json({ error: 'synthetic failure' });
  let input;
  try { input = JSON.parse(req.body.messages.at(-1).content); } catch { return res.json({ choices: [{ message: { content: '测试助手：材料已保存，可在中间工作区查看总结与关系图。' } }] }); }
  const output = input.materials ? { paragraphs: input.materials.map(part => ({ section: '更新行动与过程', text: part.text, citations: [{ sourceId: part.sourceId, blockId: part.blockId, quote: part.text, start: part.start }], units: [{ subject: '社区工作人员', subjectType: '主体', predicate: '开展', object: part.text.includes('回访') ? '后续回访' : '电话核查', objectType: '行动' }] })) } : { summary: '该测试案例记录了社区工作人员利用预警信息开展电话核查，并根据后续补充材料持续记录回访过程。所有叙述均关联原材料，可从总结稿回到原文核验。' };
  res.json({ choices: [{ message: { content: JSON.stringify(output) } }] });
});
const mockServer = mock.listen(3302, '127.0.0.1');
const app = express(); app.use(express.json({ limit: '50mb' }));
app.use('/api/research-workspace', workspaceRoutes); app.use('/api/research', researchRoutes);
app.use('/api', async (req, res) => {
  const result = await fetch(`http://127.0.0.1:3000/api${req.url}`, { method: req.method, headers: { 'Content-Type': 'application/json', ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}) }, ...(req.method !== 'GET' ? { body: JSON.stringify(req.body) } : {}) });
  res.status(result.status).type(result.headers.get('content-type') || 'application/json').send(Buffer.from(await result.arrayBuffer()));
});
app.use(express.static(path.resolve('../dist')));
app.get('/{*path}', (_, res) => res.sendFile(path.resolve('../dist/index.html')));
const server = app.listen(3301, '127.0.0.1');
const username = `cf_review_${Date.now()}`;
const user = (await pool.query('INSERT INTO users(username,password_hash) VALUES($1,$2) RETURNING id', [username, await bcrypt.hash('Review-CaseFlow-2026!', 10)])).rows[0];
const outsider = (await pool.query('INSERT INTO users(username,password_hash) VALUES($1,$2) RETURNING id', [username + '_other', await bcrypt.hash('Review-CaseFlow-2026!', 10)])).rows[0];
const schema = (await pool.query("INSERT INTO schemas(name,description) VALUES('测试框架（临时验收）','synthetic review fixture') RETURNING id")).rows[0];
const item = (await pool.query("INSERT INTO cases(name,schema_id,description,created_by) VALUES('社区养老更新 · 验收案例',$1,'用于验证多时段材料、总结稿与关系图联动的临时案例。',$2) RETURNING id", [schema.id, user.id])).rows[0];
await pool.query("INSERT INTO case_access(case_id,user_id,role) VALUES($1,$2,'owner')", [item.id, user.id]);
await pool.query("INSERT INTO user_ai_configs(user_id,endpoint,api_key,model) VALUES($1,'http://127.0.0.1:3302/','synthetic-test-key','mock')", [user.id]);
const token = jwt.sign({ id: user.id, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
const otherToken = jwt.sign({ id: outsider.id, role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
const base = `http://127.0.0.1:3301/api/research-workspace/${item.id}`;
const request = async (suffix = '', body, auth = token) => { const r = await fetch(base + suffix, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${auth}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; };
const waitJob = async () => { for (let i = 0; i < 120; i++) { const { data } = await request(); if (['completed', 'failed'].includes(data.jobs[0]?.status)) return data; await new Promise(r => setTimeout(r, 500)); } throw new Error('job timeout'); };
let cleaned = false;
async function cleanup() {
  if (cleaned) return; cleaned = true;
  await pool.query('DELETE FROM cases WHERE id=$1 AND created_by=$2', [item.id, user.id]);
  await pool.query('DELETE FROM schemas WHERE id=$1', [schema.id]);
  await pool.query('DELETE FROM user_ai_configs WHERE user_id=$1', [user.id]);
  await pool.query('DELETE FROM users WHERE id=ANY($1::int[])', [[user.id, outsider.id]]);
  const directory = path.resolve(MATERIAL_ROOT, `${schema.id}-${item.id}-material`);
  assert.ok(directory.startsWith(MATERIAL_ROOT + path.sep));
  await rm(directory, { recursive: true, force: true });
  server.close(); mockServer.close(); await pool.end();
}
try {
  const text1 = '2021年，社区工作人员根据平台预警开展电话核查。';
  const first = await request('/materials', { name: '首批材料.md', text: text1 }); assert.equal(first.status, 200);
  let state = await waitJob(); assert.equal(state.jobs[0].status, 'completed', state.jobs[0].error);
  const firstDraft = state.data.drafts.at(-1); assert.equal(firstDraft.paragraphs.length, 1);
  const raw = await fetch(base + `/materials/${first.data.sourceId}?raw=1`, { headers: { Authorization: `Bearer ${token}` } }); assert.equal(await raw.text(), text1);
  const duplicate = await request('/materials', { name: '重复.md', text: text1 }); assert.equal(duplicate.data.duplicate, true);
  const second = await request('/materials', { name: '后续材料.md', text: '2022年，社区工作人员开展后续回访。' }); assert.equal(second.status, 200);
  state = await waitJob(); assert.equal(state.jobs[0].status, 'completed', state.jobs[0].error); assert.equal(state.data.drafts.length, 2);
  const next = state.data.drafts.at(-1); assert.ok(next.paragraphs.some(p => p.id === firstDraft.paragraphs[0].id)); assert.equal(next.sourceIds.length, 2);
  assert.equal((await request('', undefined, otherToken)).status, 403);
  assert.equal((await request(`/materials/${first.data.sourceId}`, undefined, otherToken)).status, 403);
  failModel = true;
  await request('/materials', { name: '第三次材料.md', text: '2023年，社区工作人员继续开展定期电话核查。' });
  state = await waitJob(); assert.equal(state.jobs[0].status, 'failed'); assert.equal(state.data.drafts.length, 2);
  failModel = false;
  await request('/jobs', { retryId: state.jobs[0].id }); state = await waitJob(); assert.equal(state.jobs[0].status, 'completed', state.jobs[0].error); assert.equal(state.data.drafts.at(-1).sourceIds.length, 3);
  console.log('PASS: raw archive, citations, duplicate detection, incremental stable IDs, scoped access, failure preservation, durable retry');
  if (process.env.KEEP_REVIEW === '1') {
    await writeFile('/tmp/caseflow-review-fixture.json', JSON.stringify({ username, userId: user.id, caseId: item.id, schemaId: schema.id }));
    console.log(`REVIEW_READY username=${username} caseId=${item.id}`);
    process.on('SIGTERM', async () => { await cleanup(); process.exit(0); });
    process.on('SIGINT', async () => { await cleanup(); process.exit(0); });
  } else await cleanup();
} catch (e) { console.error(e); await cleanup(); process.exitCode = 1; }
