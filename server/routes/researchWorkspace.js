import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { assertCaseAccess } from '../middleware/caseAccess.js';
import { archiveMaterial, materialPath } from '../services/researchFiles.js';
import { withResearch, enqueueResearch } from '../services/researchWorker.js';
import { digest } from '../services/researchModel.js';

const router = express.Router();
router.use(authMiddleware);
router.use('/:id', async (req, res, next) => {
  try { await assertCaseAccess(req.user.id, req.params.id, req.method === 'GET' ? null : ['owner', 'editor']); next(); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); }
});
const recordFor = async req => (await pool.query('SELECT revision,data FROM case_research_work WHERE case_id=$1 AND user_id=$2', [req.params.id, req.user.id])).rows[0];
router.get('/:id', async (req, res) => {
  const record = await recordFor(req) || { revision: 0, data: { sources: [], drafts: [], extractions: [] } };
  const jobs = (await pool.query('SELECT id,status,stage,progress,error,created_at,updated_at FROM case_research_jobs WHERE case_id=$1 AND user_id=$2 ORDER BY created_at DESC LIMIT 10', [req.params.id, req.user.id])).rows;
  const data = { ...record.data, sources: record.data.sources.map(({ text, blocks, html, filePath, ...source }) => ({ ...source, hasFile: !!filePath, blockCount: blocks?.length || 0 })) };
  res.json({ ...record, data, jobs });
});
router.post('/:id/materials', async (req, res) => {
  try {
    const buffer = req.body.base64 ? Buffer.from(req.body.base64, 'base64') : Buffer.from(String(req.body.text || ''), 'utf8');
    if (!buffer.length || buffer.length > 20 * 1024 * 1024) return res.status(400).json({ error: '材料不能为空，每份最多 20 MB' });
    const existing = (await recordFor(req))?.data.sources.find(s => s.hash === digest(buffer));
    if (existing) return res.json({ sourceId: existing.id, duplicate: true });
    const info = (await pool.query('SELECT schema_id FROM cases WHERE id=$1', [req.params.id])).rows[0];
    const source = await archiveMaterial(req.params.id, info.schema_id, req.user.id, req.body);
    const result = await withResearch(req.params.id, req.user.id, data => {
      const duplicate = data.sources.find(s => s.hash === source.hash);
      if (duplicate) return { sourceId: duplicate.id, duplicate: true };
      data.sources.push(source);
      return { sourceId: source.id };
    });
    const job = !result.duplicate ? await enqueueResearch(req.params.id, req.user.id) : null;
    res.json({ ...result, job });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
router.get('/:id/materials/:sourceId', async (req, res) => {
  const record = await recordFor(req);
  const source = record?.data.sources.find(s => s.id === req.params.sourceId);
  if (!source) return res.status(404).json({ error: '材料不存在或无权读取' });
  if (req.query.raw === '1') {
    if (!source.filePath) return res.status(404).json({ error: '旧材料只有文本快照，原文件未保存' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(materialPath(source.filePath), source.title);
  }
  const { filePath, ...publicSource } = source;
  res.json({ ...publicSource, hasFile: !!filePath });
});
router.post('/:id/jobs', async (req, res) => {
  const requirements = String(req.body.requirements || '').slice(0, 12000);
  if (requirements) await withResearch(req.params.id, req.user.id, data => { data.requirements = requirements; data.requestVersion = (data.requestVersion || 0) + 1; });
  if (req.body.retryId) {
    try {
      const { rows } = await pool.query("UPDATE case_research_jobs SET status='queued',error=null,stage='等待重试',updated_at=now() WHERE id=$1 AND case_id=$2 AND user_id=$3 AND status='failed' RETURNING id", [req.body.retryId, req.params.id, req.user.id]);
      if (rows[0]) return res.json(rows[0]);
    } catch (e) { if (e.code !== '23505') throw e; }
  }
  res.json(await enqueueResearch(req.params.id, req.user.id, requirements, req.body.mode === 'reextract' ? 'reextract' : 'update'));
});
router.use((err, req, res, next) => { console.error('[research-workspace]', err.message); if (!res.headersSent) res.status(500).json({ error: '研究工作区请求失败，请重试' }); else next(err); });
export default router;
