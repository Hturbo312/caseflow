import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../../../../i18n';
import { useCaseStore, useGraphStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { extractionApi, evidenceApi, reviewApi } from '../../../../services/api';
import KnowledgeGraphCanvas from '../KnowledgeGraphCanvas';
import { locateEvidence } from './sourceLocator';
import './research.css';
import { ResearchLens } from './FrameworkGuide';
import ThreeLayerCase from './ThreeLayerCase';

const sessions = new Map();
const statuses = { pending: 'rc.status.pending', confirmed: 'rc.status.confirmed', rejected: 'rc.status.rejected' };

export function SourceReader({ caseId, evidence, positionKey = caseId }) {
  const { t } = useI18n();
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
    setNotice(found.status === 'missing' ? t('rc.source.missing') : found.status === 'exact' ? t('rc.source.located') : t('rc.source.locatedSeg'));
    if (found.segment && root.current) {
      previous.current = root.current.scrollTop;
      const el = [...root.current.querySelectorAll('[data-segment]')].find(e => e.dataset.segment === String(found.segment.id));
      if (el) root.current.scrollTo({ top: el.offsetTop - 40, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }, [evidence, segments]);
  return <section className="research-source" aria-label={t('rc.source.aria')}>
    <header><strong>{t('rc.source.title')}</strong><button disabled={previous.current == null} onClick={() => { root.current.scrollTop = previous.current; setNotice(t('rc.source.backDone')); }}>{t('rc.source.back')}</button></header>
    <p role="status">{notice || t('rc.source.hint')}</p>
    {evidence && <small>{evidence.document_title || t('rc.source.doc')}{evidence.page != null ? ` · ${t('rc.source.page', { n: evidence.page })}` : ''}</small>}
    {location?.status === 'missing' && <blockquote>{evidence.quote || t('rc.source.noQuote')}</blockquote>}
    {error && <p role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>{t('rc.source.retry')}</button></p>}
    {!segments && !error && <p>{t('rc.source.loading')}</p>}
    {segments?.length === 0 && <p>{t('rc.source.empty')}</p>}
    <div className="research-source-scroll" ref={root} onScroll={e => sessions.set(`source:${positionKey}`, e.currentTarget.scrollTop)}>
      {segments?.map(s => <article key={s.id} data-segment={s.id} className={String(location?.segment?.id) === String(s.id) ? 'located' : ''}>
        <small>{t('rc.source.paragraph')} {s.segment_index}{s.page != null ? ` · ${t('rc.source.page', { n: s.page })}` : ''}</small>
        <p>{location?.status === 'exact' && location.segment.id === s.id ? <>{s.content.slice(0, location.start)}<mark>{s.content.slice(location.start, location.end)}</mark>{s.content.slice(location.end)}</> : s.content}</p>
      </article>)}
    </div>
  </section>;
}

export function EvidenceInspector({ item, type, onLocate, onCite, onUpdated }) {
  const { t } = useI18n();
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
    <p>{statuses[status] ? t(statuses[status]) : status} · {item.entity_type || item.entityType || item.relation_type || item.relationType}</p>
    {error && <p role="alert">{error} <button onClick={() => setRetry(n => n + 1)}>{t('rc.insp.retry')}</button></p>}
    {!data && !error && <p>{t('rc.insp.loading')}</p>}
    {data?.length === 0 && <p>{t('rc.insp.none')}</p>}
    {data?.map((ev, i) => <div className="research-citation" key={ev.id}>
      <blockquote>{ev.quote || t('rc.source.noQuote')}</blockquote><small>{ev.document_title || t('rc.source.unnamed')} · {t('rc.insp.evidenceN', { i: i + 1, n: data.length })}</small>
      <div><button onClick={() => onLocate(ev)}>{t('rc.insp.view')}</button>{onCite && <button onClick={() => onCite(ev)}>{t('rc.insp.cite')}</button>}</div>
    </div>)}
    {onUpdated && <details><summary>{t('rc.insp.review')}</summary>
      <label>{t('rc.insp.name')}<input value={name} onChange={e => setName(e.target.value)} /></label>
      <label>{t('rc.insp.reason')}<input value={reason} onChange={e => setReason(e.target.value)} /></label>
      <div className="research-actions"><button disabled={busy || !name.trim()} onClick={() => act('edit')}>{t('rc.insp.save')}</button><button disabled={busy} onClick={() => act('approve')}>{t('rc.insp.confirm')}</button><button disabled={busy} onClick={() => act(status === 'rejected' ? 'restore' : 'reject')}>{status === 'rejected' ? t('rc.insp.restore') : t('rc.insp.reject')}</button></div>
    </details>}
  </div>;
}

export default function ResearchCase({ isAuthenticated, onShowLogin }) {
  const { t } = useI18n();
  const id = useWorkspaceStore(s => s.caseDetailId);
  const item = useCaseStore(s => s.cases.find(c => String(c.id) === String(id)));
  if (!item) return <div className="research-empty"><h2>{t('rc.empty.title')}</h2><p>{t('rc.empty.hint')}</p></div>;
  if (!isAuthenticated) return <div className="research-empty"><h2>{item.name}</h2><p>{item.description}</p><button onClick={onShowLogin}>{t('rc.empty.login')}</button></div>;
  return <CaseSession key={id} item={item} onShowLogin={onShowLogin} />;
}

function CaseSession({ item, onShowLogin }) {
  const { t } = useI18n();
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
      <button aria-pressed={view === 'read'} onClick={() => setView('read')}>{t('rc.head.read')}</button>
      <button aria-pressed={view === 'graph'} onClick={() => setView('graph')}>{t('rc.head.graph')}</button>
      <button aria-expanded={sourceOpen} onClick={() => setSourceOpen(v => !v)}>{sourceOpen ? t('rc.head.collapseSource') : t('rc.head.openSource')}</button>
    </div><ResearchLens caseItem={item} /></header>
    {view === 'read' && <ThreeLayerCase />}
    <details open={view === 'graph'} className="legacy-research"><summary>{view === 'graph' ? t('rc.legacy.graph') : t('rc.legacy.records')}</summary>
    <div className={`research-split ${sourceOpen ? '' : 'single'}`}>
      <div className="research-content" ref={reading} onScroll={e => { readPosition.current = e.currentTarget.scrollTop; sessions.set(String(item.id), { view, sourceOpen, scroll: readPosition.current }); }}>
        {view === 'graph' ? <div className="research-graph"><KnowledgeGraphCanvas isAuthenticated onShowLogin={onShowLogin} onInspectEntity={n => select(n, 'entity')} onInspectRelation={r => select(r, 'relation')} /></div> : <>
          <section><small>{t('rc.legacy.desc')}</small><p className="research-prose">{item.description || t('rc.legacy.noDesc')}</p></section>
          <div className="research-actions"><input aria-label={t('rc.legacy.find')} placeholder={t('rc.legacy.search')} value={q} onChange={e => setQ(e.target.value)} /><label><input type="checkbox" checked={pending} onChange={e => setPending(e.target.checked)} />{t('rc.legacy.pendingOnly')}</label></div>
          {error && <p role="alert">{t('rc.legacy.loadFail')}{error} <button onClick={() => reload().then(() => setError('')).catch(e => setError(e.message))}>{t('rc.source.retry')}</button></p>}
          {['entity', 'relation'].map(type => {
            const records = (type === 'entity' ? queue?.entities || item.entities : queue?.relations || item.relations) || [];
            const filtered = records.filter(r => (!pending || r.status === 'pending') && JSON.stringify(r).toLowerCase().includes(q.toLowerCase()));
            return <details key={type} open><summary>{type === 'entity' ? t('rc.legacy.entities') : t('rc.legacy.relations')} · {filtered.length}</summary>{filtered.map(r => <button className="research-record" key={r.id} onClick={() => select(r, type)}><span>{type === 'entity' ? r.name : `${r.source_name || r.sourceId || ''} — ${r.relation_type || r.relationType} → ${r.target_name || r.targetId || ''}`}</span><small>{r.status ? (statuses[r.status] ? t(statuses[r.status]) : r.status) : t('rc.legacy.statusNA')}</small></button>)}</details>;
          })}
        </>}
        {selection && <div ref={inspector}><button onClick={() => setSelection(null)}>{t('rc.legacy.closeSel')}</button><EvidenceInspector key={`${selection.type}:${selection.item.id}`} {...selection} onLocate={locate} onUpdated={reload} /></div>}
      </div>
      {sourceOpen && <SourceReader caseId={item.id} evidence={evidence} />}
    </div></details>
  </div>;
}
