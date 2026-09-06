import { useState, useEffect, useRef } from 'react';
import { useCaseStore, useGraphStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { extractionApi, evidenceApi, reviewApi } from '../../../../services/api';
import KnowledgeGraphCanvas from '../KnowledgeGraphCanvas';
import { locateEvidence } from './sourceLocator';
import './research.css';
import { ResearchLens } from './FrameworkGuide';

const sessions = new Map();
const statuses = { pending: '待审核', confirmed: '已确认', rejected: '已驳回' };

export function SourceReader({ caseId, evidence, positionKey = caseId }) {
  const [segments, setSegments] = useState(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [notice, setNotice] = useState('');
  const root = useRef(null);
  const previous = useRef(null);
  const scrolls = useRef(sessions.get(`source:${positionKey}`) || 0);
  useEffect(() => {
    let live = true;
    setSegments(null); setError('');
    extractionApi.getSegments(caseId).then(d => { if (live) setSegments(d.segments || []); })
      .catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [caseId, retry]);
  useEffect(() => {
    if (segments && root.current) root.current.scrollTop = scrolls.current;
  }, [segments]);
  const location = segments && evidence ? locateEvidence(segments, evidence) : null;
  useEffect(() => {
    if (!segments || !evidence) return;
    const found = locateEvidence(segments, evidence);
    setNotice(found.status === 'missing' ? '引用暂无法定位，请核对来源材料。' : found.status === 'exact' ? '已定位引用原文' : '已定位段落，未确认精确文字范围');
    if (found.segment && root.current) {
      previous.current = root.current.scrollTop;
      const el = [...root.current.querySelectorAll('[data-segment]')].find(e => e.dataset.segment === String(found.segment.id));
      if (el) root.current.scrollTo({ top: el.offsetTop - 40, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }, [evidence, segments]);
  return <section className="research-source" aria-label="原文阅读">
    <header><strong>原文与出处</strong><button disabled={previous.current == null} onClick={() => { root.current.scrollTop = previous.current; setNotice('已返回刚才位置'); }}>返回刚才位置</button></header>
    <p role="status">{notice || '点击实体或关系的引用，在这里定位原文。'}</p>
    {evidence && <small>{evidence.document_title || '来源材料'}{evidence.page != null ? ` · 第 ${evidence.page} 页` : ''} · 当前接口未提供材料版本</small>}
    {location?.status === 'missing' && <blockquote>{evidence.quote || '未保存摘录'}</blockquote>}
    {error && <p role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>重试</button></p>}
    {!segments && !error && <p>正在加载原文…</p>}
    {segments?.length === 0 && <p>尚无可定位分段，请先导入并解析材料。</p>}
    <div className="research-source-scroll" ref={root} onScroll={e => sessions.set(`source:${positionKey}`, e.currentTarget.scrollTop)}>
      {segments?.map(s => <article key={s.id} data-segment={s.id} className={String(location?.segment?.id) === String(s.id) ? 'located' : ''}>
        <small>段落 {s.segment_index}{s.page != null ? ` · 第 ${s.page} 页` : ''}</small>
        <p>{location?.status === 'exact' && location.segment.id === s.id ? <>{s.content.slice(0, location.start)}<mark>{s.content.slice(location.start, location.end)}</mark>{s.content.slice(location.end)}</> : s.content}</p>
      </article>)}
    </div>
  </section>;
}

export function EvidenceInspector({ item, type, onLocate, onCite, onUpdated }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [reason, setReason] = useState('');
  const [status, setStatus] = useState(item.status || 'pending');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let live = true;
    setData(null); setError(''); setStatus(item.status || 'pending');
    setName(type === 'entity' ? item.name : item.relation_type || item.relationType || '');
    (type === 'entity' ? evidenceApi.getByEntity(item.id) : evidenceApi.getByRelation(item.id))
      .then(d => { if (live) setData(d.evidence || []); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [item.id, item.status, type, retry]);
  async function act(action) {
    setBusy(true); setError('');
    try {
      await (type === 'entity' ? reviewApi.entityAction : reviewApi.relationAction)(item.id, action,
        { reason, ...(action === 'edit' ? type === 'entity' ? { name } : { relationType: name } : {}) });
      setStatus(action === 'approve' ? 'confirmed' : action === 'reject' ? 'rejected' : action === 'restore' ? 'pending' : status);
      await onUpdated?.();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="research-inspector">
    <strong>{type === 'entity' ? item.name : `${item.source_name || item.sourceId || ''} → ${item.target_name || item.targetId || ''}`}</strong>
    <p>{statuses[status] || status} · {item.entity_type || item.entityType || item.relation_type || item.relationType}</p>
    {error && <p role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>重试读取证据</button></p>}
    {!data && !error && <p>正在读取证据…</p>}
    {data?.length === 0 && <p>没有已关联证据；这不表示该现象没有发生。</p>}
    {data?.map((ev, i) => <div className="research-citation" key={ev.id}>
      <blockquote>{ev.quote || '未保存引文'}</blockquote><small>{ev.document_title || '来源未命名'} · 证据 {i + 1}/{data.length}</small>
      <div><button onClick={() => onLocate(ev)}>查看原文</button>{onCite && <button onClick={() => onCite(ev)}>加入发现引用</button>}</div>
    </div>)}
    {onUpdated && <details><summary>就地审核与修改</summary>
      <label>名称 / 关系类型<input value={name} onChange={e => setName(e.target.value)} /></label>
      <label>审核理由<input value={reason} onChange={e => setReason(e.target.value)} /></label>
      <div className="research-actions"><button disabled={busy || !name.trim()} onClick={() => act('edit')}>保存修改</button><button disabled={busy} onClick={() => act('approve')}>确认</button><button disabled={busy} onClick={() => act(status === 'rejected' ? 'restore' : 'reject')}>{status === 'rejected' ? '恢复待审' : '驳回'}</button></div>
    </details>}
  </div>;
}

export default function ResearchCase({ isAuthenticated, onShowLogin }) {
  const id = useWorkspaceStore(s => s.caseDetailId);
  const item = useCaseStore(s => s.cases.find(c => String(c.id) === String(id)));
  if (!item) return <div className="research-empty"><h2>开始案例研究</h2><p>在右侧打开一个案例，连续阅读材料、查看关系和核查证据。</p></div>;
  if (!isAuthenticated) return <div className="research-empty"><h2>{item.name}</h2><p>{item.description}</p><button onClick={onShowLogin}>登录后阅读原文与整理证据</button></div>;
  return <CaseSession key={id} item={item} onShowLogin={onShowLogin} />;
}

function CaseSession({ item, onShowLogin }) {
  const saved = sessions.get(String(item.id)) || {};
  const [view, setView] = useState(saved.view || 'read');
  const [sourceOpen, setSourceOpen] = useState(saved.sourceOpen ?? true);
  const [selection, setSelection] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [q, setQ] = useState('');
  const [pending, setPending] = useState(false);
  const [queue, setQueue] = useState(null);
  const [error, setError] = useState('');
  const reading = useRef(null);
  const inspector = useRef(null);
  const readPosition = useRef(saved.scroll || 0);
  useEffect(() => { sessions.set(String(item.id), { view, sourceOpen, scroll: readPosition.current }); }, [item.id, view, sourceOpen]);
  useEffect(() => { if (reading.current) reading.current.scrollTop = readPosition.current; }, [view]);
  useEffect(() => { inspector.current?.scrollIntoView({ block: 'nearest' }); }, [selection]);
  useEffect(() => {
    useCaseStore.getState().setCurrentCase(String(item.id));
    useGraphStore.getState().setFocusCase(String(item.id));
  }, [item.id]);
  useEffect(() => {
    let live = true;
    reviewApi.queues(item.id).then(d => { if (live) setQueue(d); }).catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [item.id]);
  async function reload() {
    const d = await reviewApi.queues(item.id); setQueue(d);
    await useCaseStore.getState().loadCases();
  }
  const select = (record, type) => {
    const records = type === 'entity' ? queue?.entities || item.entities : queue?.relations || item.relations;
    setSelection({ item: records?.find(r => String(r.id) === String(record.id)) || record, type });
    if (type === 'entity') useWorkspaceStore.getState().selectEntity(record.id);
  };
  const locate = ev => { setEvidence({ ...ev }); setSourceOpen(true); };
  return <div className="research-case">
    <header className="research-head"><h2>{item.name}</h2><div className="research-actions">
      <button aria-pressed={view === 'read'} onClick={() => setView('read')}>阅读整理</button>
      <button aria-pressed={view === 'graph'} onClick={() => setView('graph')}>关系图</button>
      <button aria-expanded={sourceOpen} onClick={() => setSourceOpen(v => !v)}>{sourceOpen ? '收起原文' : '打开原文'}</button>
    </div><ResearchLens caseItem={item} /></header>
    <div className={`research-split ${sourceOpen ? '' : 'single'}`}>
      <div className="research-content" ref={reading} onScroll={e => { readPosition.current = e.currentTarget.scrollTop; sessions.set(String(item.id), { view, sourceOpen, scroll: readPosition.current }); }}>
        {view === 'graph' ? <div className="research-graph"><KnowledgeGraphCanvas isAuthenticated onShowLogin={onShowLogin} onInspectEntity={n => select(n, 'entity')} onInspectRelation={r => select(r, 'relation')} /></div> : <>
          <section><small>案例整理稿 · 核查内容请查看原文</small><p className="research-prose">{item.description || '尚未填写案例整理稿。可先阅读右侧原文。'}</p></section>
          <div className="research-actions"><input aria-label="查找实体与关系" placeholder="查找实体、关系…" value={q} onChange={e => setQ(e.target.value)} /><label><input type="checkbox" checked={pending} onChange={e => setPending(e.target.checked)} />仅待审核</label></div>
          {error && <p role="alert">审核数据读取失败：{error} <button onClick={() => reload().then(() => setError('')).catch(e => setError(e.message))}>重试</button></p>}
          {['entity', 'relation'].map(type => {
            const records = (type === 'entity' ? queue?.entities || item.entities : queue?.relations || item.relations) || [];
            const filtered = records.filter(r => (!pending || r.status === 'pending') && JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
            return <details key={type} open><summary>{type === 'entity' ? '实体' : '关系'} · {filtered.length}</summary>{filtered.map(r => <button className="research-record" key={r.id} onClick={() => select(r, type)}><span>{type === 'entity' ? r.name : `${r.source_name || r.sourceId || ''} — ${r.relation_type || r.relationType} → ${r.target_name || r.targetId || ''}`}</span><small>{statuses[r.status] || r.status || '状态未提供'}</small></button>)}</details>;
          })}
        </>}
        {selection && <div ref={inspector}><button onClick={() => setSelection(null)}>关闭所选记录</button><EvidenceInspector key={`${selection.type}:${selection.item.id}`} {...selection} onLocate={locate} onUpdated={reload} /></div>}
      </div>
      {sourceOpen && <SourceReader caseId={item.id} evidence={evidence} />}
    </div>
  </div>;
}
