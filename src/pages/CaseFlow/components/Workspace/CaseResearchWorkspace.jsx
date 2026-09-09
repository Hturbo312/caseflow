import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { FilePlus2, MessageSquareText, BookOpenText, Network, ChevronRight, Files, X, RefreshCw } from 'lucide-react';
import { useAuthStore, useCaseStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { useResearchWorkspaceStore } from '../../../../store/researchWorkspaceStore';
import { researchRequest } from '../../../../services/researchWorkspace';
import { researchApi } from '../../../../services/api';
import ResearchGraph from './ResearchGraph';
import { collectUnits } from './researchGraphModel';
import MaterialReader from './MaterialReader';
import './case-research-workspace.css';

function FlowGuide({ onCreate }) {
  const steps = [
    [FilePlus2, '开始一个案例', '创建新案例，或从右侧案例集选择已有案例。'],
    [MessageSquareText, '在左侧与 Agent 协作', '上传材料、粘贴文本，说明研究要求并持续对话。'],
    [BookOpenText, '阅读 AI 总结稿', '查看案例摘要和连续叙述，点击材料索引核验原文。'],
    [Network, '探索案例关系图', '默认查看完整案例图；选中总结片段，查看对应子图。'],
  ];
  return <section className="crw-guide"><span className="crw-guide-label">案例研究</span><h2>从材料出发，读懂一个案例</h2><p>材料、总结稿与关系图相互关联。后续补充材料时，继续在同一个案例中研究。</p><ol>{steps.map(([Icon, title, text], i) => <li key={title}><div className="crw-step-icon">{createElement(Icon, { size: 21 })}</div><div><strong>{title}</strong><p>{text}</p></div>{i < steps.length - 1 && <ChevronRight className="crw-step-next" size={18} />}</li>)}</ol><button className="crw-primary" onClick={onCreate}><FilePlus2 size={16} />创建新案例</button><small>也可以直接选择右侧案例，继续研究。</small></section>;
}
export default function CaseResearchWorkspace({ onCreate }) {
  const caseId = useWorkspaceStore(s => s.caseDetailId);
  const item = useCaseStore(s => s.cases.find(c => String(c.id) === String(caseId)));
  return item ? <CaseSession key={caseId} item={item} /> : <FlowGuide onCreate={onCreate} />;
}
function CaseSession({ item }) {
  const userId = useAuthStore(s => s.user?.id);
  const key = `${userId}:${item.id}`;
  const record = useResearchWorkspaceStore(s => s.records[key]);
  const load = useResearchWorkspaceStore(s => s.load);
  const selectContext = useResearchWorkspaceStore(s => s.select);
  const [version, setVersion] = useState(''), [chunkId, setChunkId] = useState(null), [selection, setSelection] = useState([]);
  const [reader, setReader] = useState(null), [materialsOpen, setMaterialsOpen] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [ratio, setRatio] = useState(50), [readerWidth, setReaderWidth] = useState(42);
  const split = useRef(null), body = useRef(null), drag = useRef(null), reading = useRef(null);
  useEffect(() => {
    let live = true, timer;
    const refresh = async () => { try { await load(key, item.id); if (live) setError(''); } catch (e) { if (live) setError(e.message); } };
    const poll = async () => { await refresh(); if (live) timer = setTimeout(poll, 4000); };
    poll();
    const update = e => { if (String(e.detail?.caseId) === String(item.id)) refresh(); };
    window.addEventListener('cf:research-updated', update);
    return () => { live = false; clearTimeout(timer); window.removeEventListener('cf:research-updated', update); };
  }, [key, item.id, load]);
  useEffect(() => {
    const move = e => {
      if (drag.current === 'rows') { const rect = split.current.getBoundingClientRect(); setRatio(Math.max(25, Math.min(75, (e.clientY - rect.top) / rect.height * 100))); }
      if (drag.current === 'reader') { const rect = body.current.getBoundingClientRect(); setReaderWidth(Math.max(28, Math.min(64, (rect.right - e.clientX) / rect.width * 100))); }
    };
    const up = () => { drag.current = null; };
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
  }, []);
  const data = record?.data;
  const draft = data?.drafts.find(d => d.id === version) || data?.drafts.at(-1);
  const selectedChunk = draft?.paragraphs.find(p => p.id === chunkId);
  const allUnits = useMemo(() => collectUnits(draft, data?.extractions, item), [draft, data?.extractions, item]);
  const units = useMemo(() => selectedChunk ? allUnits.filter(u => u.paragraphIds?.includes(selectedChunk.id)) : allUnits, [allUnits, selectedChunk]);
  useEffect(() => { selectContext(key, selectedChunk ? { paragraphId: selectedChunk.id, text: selectedChunk.text, citations: selectedChunk.citations, draftId: draft?.id } : null); }, [selectedChunk, draft?.id, key, selectContext]);
  useEffect(() => { setSelection([]); }, [draft?.id]);
  const job = record?.jobs?.[0];
  const running = ['queued', 'running'].includes(job?.status);
  const chooseChunk = p => { setChunkId(chunkId === p.id ? null : p.id); setSelection([]); };
  const locate = citation => setReader({ sourceId: citation.sourceId, citation });
  const inspect = next => {
    setSelection(next);
    const id = next[0]?.paragraphIds?.[0];
    if (id) { setChunkId(id); reading.current?.querySelector(`[data-chunk="${id}"]`)?.scrollIntoView({ block: 'nearest' }); }
  };
  async function run(options = {}) {
    setBusy(true); setError('');
    try { await researchRequest(item.id, '/jobs', options); await load(key, item.id); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function confirmDraft() {
    setBusy(true);
    try { await researchApi.act(item.id, record.revision, 'reviewDraft', { id: draft.id, status: 'confirmed' }); await load(key, item.id); } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  function citationLabel(c) {
    const index = data?.sources.findIndex(s => s.id === c.sourceId);
    return `材料 ${index >= 0 ? index + 1 : '?'}${c.page ? ` · 第${c.page}页` : ''}`;
  }
  const citations = list => list?.map((c, i) => <button className="crw-citation" key={`${c.sourceId}-${i}`} title={`${data?.sources.find(s => s.id === c.sourceId)?.title || ''}\n${c.quote}`} onClick={e => { e.stopPropagation(); locate(c); }}>{citationLabel(c)}</button>);
  return <section className="crw-workspace" aria-label="单个案例研究工作区">
    <header className="crw-header"><div><h2>{item.name}</h2><small>单个案例研究 · 材料持续积累</small></div><div className="crw-actions"><button onClick={() => setMaterialsOpen(v => !v)} aria-expanded={materialsOpen}><Files size={15} />材料 {data?.sources.length || 0}</button><button disabled={busy || running || !data?.sources.length} onClick={() => run()}><RefreshCw size={14} />更新总结与图谱</button></div></header>
    {error && <div className="crw-notice" role="alert">{error}</div>}
    {job && <div className={`crw-job ${job.status}`} role="status"><span>{job.status === 'failed' ? job.error : job.stage}</span>{running && <><progress max="100" value={job.progress} /><small>可继续对话或离开页面</small></>}{job.status === 'failed' && <button disabled={busy} onClick={() => run({ retryId: job.id })}>重试</button>}</div>}
    {materialsOpen && <div className="crw-materials"><header><strong>案例材料</strong><button onClick={() => setMaterialsOpen(false)} aria-label="关闭材料列表"><X size={14} /></button></header>{!data?.sources.length && <p>使用左侧附件按钮上传文件，或点击“粘贴材料”录入文本。</p>}{data?.sources.map((s, i) => <button key={s.id} onClick={() => setReader({ sourceId: s.id })}><span>材料 {i + 1} · {s.title}</span><small>{({ ready: '已读取', pending: '待处理', failed: '解析失败', unsupported: '已归档 · 待补充可读文本' })[s.status] || '文本快照'} · {new Date(s.createdAt).toLocaleDateString()}</small></button>)}</div>}
    <div className={`crw-body ${reader ? 'has-reader' : ''}`} ref={body} style={{ '--crw-reader-width': `${readerWidth}%` }}>
      <div className="crw-split" ref={split} style={{ gridTemplateRows: `minmax(0, ${ratio}fr) 9px minmax(0, ${100 - ratio}fr)` }}>
        <section className="crw-draft" aria-label="AI 总结稿">
          <header className="crw-pane-header"><strong>AI 总结稿</strong><div>{draft && <><select aria-label="总结稿版本" value={draft.id} onChange={e => { setVersion(e.target.value); setChunkId(null); setSelection([]); }}>{data.drafts.map((d, i) => <option key={d.id} value={d.id}>版本 {i + 1}{d.status === 'confirmed' ? ' · 已核验' : ' · 待核验'}</option>)}</select><button disabled={busy || running || draft.status === 'confirmed'} onClick={confirmDraft}>确认稿件</button></>}</div></header>
          <div className="crw-prose-scroll" ref={reading}>
            <section className="crw-summary"><span>案例摘要</span><p>{draft?.summary || (draft ? '此历史稿件尚无案例摘要。更新总结与图谱后生成。' : '上传材料并说明研究要求后，Agent 会在这里生成案例摘要。')}</p></section>
            {!draft && <div className="crw-draft-empty"><BookOpenText size={26} /><h3>开始积累这个案例的材料</h3><p>在左侧上传文件或粘贴文本，与 Agent 说明你关心的问题。总结稿将在这里连续展开，每个片段都可回到原始证据。</p></div>}
            {draft?.paragraphs.map((p, i) => <div key={p.id}>{p.section !== draft.paragraphs[i - 1]?.section && <h3 className="crw-section-heading">{p.section || '案例叙述'}</h3>}<article className={`crw-chunk ${selectedChunk?.id === p.id ? 'selected' : ''}`} data-chunk={p.id} tabIndex={0} aria-label={`片段 ${i + 1}，${selectedChunk?.id === p.id ? '已选中' : '点击查看关系子图'}`} onClick={() => chooseChunk(p)} onKeyDown={e => { if (e.target === e.currentTarget && ['Enter', ' '].includes(e.key)) { e.preventDefault(); chooseChunk(p); } }}><div className="crw-chunk-meta"><span>片段 {String(i + 1).padStart(2, '0')}</span>{p.kind === 'conflict' && <em>材料存在冲突</em>}{p.kind === 'gap' && <em>证据缺口</em>}{selectedChunk?.id === p.id && <span>正在查看子图</span>}</div><p>{p.text}</p><div className="crw-citations">{citations(p.citations)}</div></article></div>)}
            {draft?.changeNote && <p className="crw-version-note">{draft.changeNote}</p>}
          </div>
        </section>
        <div className="crw-row-handle" role="separator" tabIndex={0} aria-label="调整总结稿与关系图高度" aria-orientation="horizontal" aria-valuenow={ratio} aria-valuemin={25} aria-valuemax={75} onKeyDown={e => { if (['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); setRatio(v => Math.max(25, Math.min(75, v + (e.key === 'ArrowUp' ? -5 : 5)))); } }} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = 'rows'; }}><span /></div>
        <section className="crw-graph" aria-label="案例关系图"><header className="crw-pane-header"><strong>{selectedChunk ? `片段 ${draft.paragraphs.findIndex(p => p.id === chunkId) + 1} · 关系子图` : '当前案例 · 完整关系图'}</strong><div><small>{units.length} 个关系单元</small>{selectedChunk && <button onClick={() => { setChunkId(null); setSelection([]); }}>查看全案例</button>}</div></header><div className="crw-graph-canvas"><ResearchGraph units={units} onSelect={inspect} selectedId={selection[0]?.id} />{selection.length > 0 && <aside className="crw-unit-inspector"><header><strong>关系单元与证据</strong><button onClick={() => setSelection([])} aria-label="关闭关系详情">×</button></header>{selection.map(u => <article key={u.id}><p><strong>{u.subject}</strong> — {u.predicate} → <strong>{u.object}</strong></p>{u.time && <small>{u.time}</small>}{u.context && <p>{u.context}</p>}<div>{citations(u.citations)}</div>{!u.citations?.length && <small>历史图谱关系，尚未绑定本工作区的总结片段。</small>}</article>)}</aside>}</div><footer>虚线表示待核验关系 · 点击关系查看证据</footer></section>
      </div>
      {reader && <><div className="crw-reader-handle" role="separator" tabIndex={0} aria-label="调整原材料宽度" aria-orientation="vertical" aria-valuenow={readerWidth} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); drag.current = 'reader'; }} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight'].includes(e.key)) { e.preventDefault(); setReaderWidth(v => Math.max(28, Math.min(64, v + (e.key === 'ArrowLeft' ? 4 : -4)))); } }} /><MaterialReader key={`${reader.sourceId}:${reader.citation?.start ?? "all"}`} caseId={item.id} sourceId={reader.sourceId} citation={reader.citation} onClose={() => setReader(null)} /></>}
    </div>
  </section>;
}
