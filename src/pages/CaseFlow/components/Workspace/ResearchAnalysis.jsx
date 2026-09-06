import { useState, useEffect } from 'react';
import { useCaseStore, useSchemaStore } from '../../../../store';
import { useCompareStore } from '../../../../store/compareStore';
import { useAuth } from '../../../../hooks';
import { EvidenceInspector, SourceReader } from './ResearchCase';
import AnalysisWorkspace from './AnalysisWorkspace';
import { downloadBlob } from './exportUtils';
import './research.css';
const drafts = new Map();

export default function ResearchAnalysis() {
  const cases = useCaseStore(s => s.cases);
  const { ids, toggle, remove, MAX } = useCompareStore();
  const schemaId = useSchemaStore(s => s.currentSchemaId);
  const { user, isAuthenticated } = useAuth();
  return <AnalysisSession key={`${user?.id || 'guest'}:${schemaId}`} cases={cases} ids={ids} toggle={toggle} remove={remove} MAX={MAX} schemaId={schemaId} user={user} isAuthenticated={isAuthenticated} />;
}

function AnalysisSession({ cases, ids, toggle, remove, MAX, schemaId, user, isAuthenticated }) {
  const key = `cf-research-draft:${user?.id || 'guest'}:${schemaId}`;
  const [draft, setDraft] = useState(() => { try { return drafts.get(key) || JSON.parse(localStorage.getItem(key)) || { question: '', finding: '', limits: '', citations: [], caseIds: [] }; } catch { return { question: '', finding: '', limits: '', citations: [], caseIds: [] }; } });
  useEffect(() => { drafts.set(key, draft); }, [key, draft]);
  const [message, setMessage] = useState('');
  const [active, setActive] = useState(null);
  const [preview, setPreview] = useState(null);
  const [tools, setTools] = useState(false);
  const selected = cases.filter(c => ids.includes(String(c.id)));
  const update = (field, value) => setDraft(d => ({ ...d, [field]: value }));
  const save = () => {
    const next = { ...draft, caseIds: [...ids], schemaId, updatedAt: new Date().toISOString() };
    try { localStorage.setItem(key, JSON.stringify(next)); setDraft(next); setMessage('已保存到此浏览器；尚未同步到服务器。'); } catch { setMessage('保存失败，请导出备份。'); }
  };
  const cite = ev => {
    const citation = { ...ev, caseId: active.caseId, itemId: active.item.id, type: active.type };
    setDraft(d => ({ ...d, citations: [...d.citations.filter(c => c.id !== ev.id), citation] }));
    setMessage('已加入引用，请保存研究草稿。');
  };
  const exportFinding = () => {
    const text = `# ${draft.question || '研究发现'}\n\n案例范围：${selected.map(c => c.name).join('、')}\n框架 ID：${schemaId}（此草稿未冻结版本）\n\n${draft.finding}\n\n## 反例与局限\n${draft.limits}\n\n## 引用\n${draft.citations.map((c, i) => `${i + 1}. 案例 ${c.caseId}，${c.document_title || '未命名材料'}，分段 ${c.segment_id || '未定位'}，证据 ${c.id}\n> ${c.quote || ''}`).join('\n\n')}`;
    downloadBlob(new Blob([text], { type: 'text/markdown;charset=utf-8' }), '研究发现.md');
  };
  return <div className="research-analysis">
    <h2>从一个研究问题开始</h2><p>选择案例，核对证据，再记录发现。辅助图表可在需要时展开。</p>
    <label>研究问题<input value={draft.question} onChange={e => update('question', e.target.value)} placeholder="例如：相似技术为何产生不同实施结果？" /></label>
    <details><summary>选择比较案例（{ids.length}/{MAX}）</summary>{cases.map(c => <label key={c.id}><input type="checkbox" checked={ids.includes(String(c.id))} disabled={!ids.includes(String(c.id)) && ids.length >= MAX} onChange={() => toggle(c.id)} /> {c.name}</label>)}</details>
    <div className="research-actions">{selected.map(c => <button key={c.id} onClick={() => remove(c.id)}>{c.name} ×</button>)}</div>
    {ids.length < 2 && <p>请选择至少两个案例开始比较。当前不会自动使用其他案例代替你的选择。</p>}
    {draft.caseIds?.length > 0 && draft.caseIds.join(',') !== ids.join(',') && <p role="status">比较集与上次保存不同，请复核已有发现与引用。</p>}
    <div className="research-comparison">{selected.map(c => <section key={c.id}><h3>{c.name}</h3><p>{c.description || '尚无案例整理稿'}</p><button disabled={!isAuthenticated} onClick={() => setPreview({ caseId: c.id, evidence: null })}>阅读原文</button>
      <details><summary>选择实体核查证据（{c.entities?.length || 0}）</summary>{c.entities?.map(e => <button className="research-record" key={e.id} onClick={() => { setActive({ item: e, type: 'entity', caseId: c.id }); setPreview(null); }}>{e.name}</button>)}</details>
      <details><summary>选择关系核查证据（{c.relations?.length || 0}）</summary>{c.relations?.map(r => <button className="research-record" key={r.id} onClick={() => { setActive({ item: r, type: 'relation', caseId: c.id }); setPreview(null); }}>{r.relationType || r.relation_type} · {r.sourceId} → {r.targetId}</button>)}</details>
    </section>)}</div>
    {active && isAuthenticated && <EvidenceInspector key={`${active.type}:${active.item.id}`} {...active} onLocate={ev => setPreview({ caseId: active.caseId, evidence: ev })} onCite={cite} />}
    {preview && <div className="research-preview"><button onClick={() => setPreview(null)}>关闭原文预览，继续分析</button><SourceReader key={preview.caseId} caseId={preview.caseId} evidence={preview.evidence} positionKey={`analysis:${preview.caseId}`} /></div>}
    <label>研究发现<textarea value={draft.finding} onChange={e => update('finding', e.target.value)} placeholder="写下共性、差异及解释，并在上方核查引用。" /></label>
    <label>反例、适用条件与局限<textarea value={draft.limits} onChange={e => update('limits', e.target.value)} /></label>
    <p>已关联 {draft.citations.length} 条引用 · 草稿尚未冻结材料及框架版本</p>
    {draft.citations.map(c => <div key={c.id}><button onClick={() => setPreview({ caseId: c.caseId, evidence: c })}>{c.document_title || '来源材料'} · {c.quote?.slice(0, 50)}</button><button onClick={() => update('citations', draft.citations.filter(x => x.id !== c.id))}>移除引用</button></div>)}
    <div className="research-actions"><button onClick={save}>保存本机草稿</button><button onClick={exportFinding}>导出发现与引用</button></div><p role="status">{message}</p>
    <details className="research-tools" onToggle={e => setTools(e.currentTarget.open)}><summary>辅助图表与数据质量检查</summary>{tools && ids.length >= 2 && isAuthenticated ? <AnalysisWorkspace /> : <p>选择至少两个案例并登录后，可查看已有分析图表。</p>}</details>
  </div>;
}
