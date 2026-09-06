import express from 'express';
import pool from '../db.js';
import { authMiddleware } from '../middleware/auth.js';
import { randomUUID } from 'node:crypto';

const router = express.Router();
// Additive, private research records. Existing cases and graph records are untouched.
export async function initializeResearch() {
  await pool.query(`CREATE TABLE IF NOT EXISTS case_research_work (
    case_id INTEGER REFERENCES cases(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL DEFAULT 0,
    data JSONB NOT NULL DEFAULT '{"sources":[],"drafts":[],"extractions":[]}',
    PRIMARY KEY (case_id,user_id))`);
}
router.use(authMiddleware);
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT revision,data FROM case_research_work WHERE case_id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json(rows[0] || { revision: 0, data: { sources: [], drafts: [], extractions: [] } });
  } catch { res.status(500).json({ error: '研究材料读取失败' }); }
});
router.post('/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO case_research_work(case_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [req.params.id, req.user.id]);
    const { rows } = await client.query('SELECT revision,data FROM case_research_work WHERE case_id=$1 AND user_id=$2 FOR UPDATE', [req.params.id, req.user.id]);
    const { revision, data } = rows[0];
    const { action, payload } = req.body;
    if (req.body.revision !== revision) { const e = new Error('材料已在其他窗口更新，请刷新后重试。'); e.status = 409; throw e; }
    const fail = message => { const e = new Error(message); e.status = 400; throw e; };
    const text = (s, n) => typeof s === 'string' && s.trim().length > 0 && s.length <= n;
    if (action === 'source') {
      if (!text(payload?.title, 500) || !text(payload?.text, 200000)) fail('请填写来源标题和正文（每份最多 20 万字符）。');
      if (data.sources.length >= 50) fail('当前案例最多保存 50 份来源。');
      if (data.sources.some(s => s.text === payload.text)) fail('这份材料已登记，无需重复导入。');
      data.sources.push({ id: randomUUID(), title: payload.title, text: payload.text, uri: String(payload.uri || '').slice(0, 2000), author: String(payload.author || '').slice(0, 500), date: String(payload.date || '').slice(0, 100), createdAt: new Date().toISOString() });
    } else if (action === 'draft') {
      if (!Array.isArray(payload?.paragraphs) || !payload.paragraphs.length || payload.paragraphs.length > 100) fail('整理稿段落格式错误。');
      const paragraphs = payload.paragraphs.map(p => {
        if (!text(p.text, 10000) || !Array.isArray(p.citations) || !p.citations.length || p.citations.length > 20) fail('每段整理稿必须关联原文引用。');
        const citations = p.citations.map(c => {
          const source = data.sources.find(s => s.id === c.sourceId);
          if (!source || !text(c.quote, 10000) || !source.text.includes(c.quote)) fail('引用无法匹配原文，整理稿未保存；请重新生成或核对材料。');
          return { sourceId: source.id, quote: c.quote, start: source.text.indexOf(c.quote) };
        });
        return { id: randomUUID(), text: p.text, kind: ['fact','conflict','gap'].includes(p.kind) ? p.kind : 'fact', citations };
      });
      if (data.drafts.length >= 50) fail('已达到 50 个整理版本。');
      data.drafts.push({ id: randomUUID(), paragraphs, status: 'pending', createdAt: new Date().toISOString() });
    } else if (action === 'reviewDraft') {
      const draft = data.drafts.find(d => d.id === payload?.id);
      if (!draft || !['confirmed','rejected'].includes(payload.status)) fail('整理稿或审核状态无效。');
      draft.status = payload.status;
    } else if (action === 'extract') {
      const draft = data.drafts.find(d => d.id === payload?.draftId);
      if (!draft || draft.status !== 'confirmed') fail('请先确认整理稿，再抽取候选知识。');
      if (!Array.isArray(payload.items) || payload.items.length > 200) fail('候选知识格式错误。');
      if (data.extractions.length >= 50) fail('已达到 50 个抽取版本。');
      const items = payload.items.map(i => {
        if (!text(i.name, 500) || !text(i.type, 200) || !Array.isArray(i.paragraphIds) || !i.paragraphIds.length || i.paragraphIds.some(id => !draft.paragraphs.some(p => p.id === id))) fail('候选知识必须关联有效的整理稿段落。');
        return { id: randomUUID(), name: i.name, type: i.type, kind: i.kind === 'relation' ? 'relation' : 'entity', paragraphIds: [...new Set(i.paragraphIds)], status: 'pending' };
      });
      data.extractions.push({ id: randomUUID(), draftId: draft.id, items, createdAt: new Date().toISOString() });
    } else if (action === 'reviewItem') {
      const item = data.extractions.flatMap(e => e.items).find(i => i.id === payload?.id);
      if (!item || !['confirmed','rejected','pending'].includes(payload.status)) fail('候选知识或审核状态无效。');
      item.status = payload.status;
    } else fail('未知研究操作。');
    await client.query('UPDATE case_research_work SET data=$3,revision=revision+1 WHERE case_id=$1 AND user_id=$2', [req.params.id, req.user.id, JSON.stringify(data)]);
    await client.query('COMMIT');
    res.json({ revision: revision + 1, data });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(e.status || 500).json({ error: e.status ? e.message : '研究材料保存失败，请确认案例仍存在后重试。' });
  } finally { client.release(); }
});
export default router;
