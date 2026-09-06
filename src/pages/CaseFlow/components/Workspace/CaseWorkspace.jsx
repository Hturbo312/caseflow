import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileText, ShieldCheck, ClipboardCheck, Layers, Search, Share2,
  Check, X, RotateCcw, Pencil, Quote, Loader2, MousePointerClick, ClipboardCopy,
} from 'lucide-react';
import { useCaseStore, useSchemaStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { evidenceApi, reviewApi, extractionApi } from '../../../../services/api';
import { useI18n } from '../../../../i18n';
import { useToastStore } from '../../../../components/Toast/ToastStore.js';
import KnowledgeGraphCanvas from '../KnowledgeGraphCanvas';

// label 为 i18n key，渲染处用 t() 转换
const SUB_TABS = [
  { id: 'overview', labelKey: 'schema.overview', icon: Layers },
  { id: 'graph', labelKey: 'ws.tab.graph', icon: Share2 },
  { id: 'source', labelKey: 'ws.tab.source', icon: FileText },
  { id: 'evidence', labelKey: 'ws.tab.evidence', icon: Quote },
  { id: 'review', labelKey: 'ws.tab.review', icon: ClipboardCheck },
];

// 状态值 -> i18n key（渲染处用 t() 转换）
const STATUS_LABEL = {
  confirmed: 'pipeline.approved', limited: 'ws.status.limited', blocked: 'ws.status.blocked', not_evidenced: 'ws.status.notEvidenced',
  pending: 'pipeline.pending', rejected: 'ws.status.rejected',
};
const STATUS_CLASS = {
  confirmed: 'ok', limited: 'warn', blocked: 'bad', not_evidenced: 'na',
  pending: 'warn', rejected: 'bad',
};
const CASE_STATUS_LABEL = { core: 'ws.caseStatus.core', candidate: 'ws.caseStatus.candidate', boundary: 'ws.caseStatus.boundary', experiment: 'ws.caseStatus.experiment' };

// 审阅条目可能的原文（source）字段，取第一个非空值；都没有则视为无原文
const sourceTextOf = (item) =>
  item.source_text || item.quote || item.evidence_quote || item.context || item.description || '';

export default function CaseWorkspace({ onShowLogin, isAuthenticated }) {
  const { t } = useI18n();
  const { caseDetailId, caseSubTab, setCaseSubTab, selectEntity, setContextTask } = useWorkspaceStore();
  const { cases } = useCaseStore();
  const { schemas } = useSchemaStore();
  const caseItem = useMemo(
    () => cases.find((c) => String(c.id) === String(caseDetailId)),
    [cases, caseDetailId]
  );

  if (!caseDetailId || !caseItem) {
    return (
      <div className="ws-empty">
        <MousePointerClick size={28} />
        <p>{t('ws.empty.title')}</p>
        <span>{t('ws.empty.hint')}</span>
      </div>
    );
  }

  // 访客：案例详情由服务端加载，需登录（预览卡仍可只读浏览）
  if (!isAuthenticated) {
    return (
      <div className="ws-empty">
        <MousePointerClick size={28} />
        <p>{caseItem.name}</p>
        <span>{t('app.loginPrompt')}</span>
        <button className="ws-act" style={{ marginTop: 10 }} onClick={() => onShowLogin?.()}>
          {t('app.login')}
        </button>
      </div>
    );
  }

  const schema = schemas.find((s) => String(s.id) === String(caseItem.schema_id || caseItem.schemaId));
  const meta = caseItem.metadata || {};
  const code = meta.case_code || '';

  return (
    <div className="ws-case">
      <div className="ws-case-header">
        <div className="ws-case-title">
          <h2>{caseItem.name}</h2>
          {code && <span className="ws-badge code">{code}</span>}
          {caseItem.case_status && (
            <span className={`ws-badge ${caseItem.case_status === 'core' ? 'ok' : 'na'}`}>
              {CASE_STATUS_LABEL[caseItem.case_status] ? t(CASE_STATUS_LABEL[caseItem.case_status]) : caseItem.case_status}
            </span>
          )}
        </div>
        <div className="ws-case-sub">
          {[caseItem.location, caseItem.year && `${caseItem.year}${t('case.yearSuffix')}`, schema?.name]
            .filter(Boolean).join(' ｜ ')}
        </div>
        <nav className="ws-subtabs">
          {SUB_TABS.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              className={caseSubTab === id ? 'active' : ''}
              onClick={() => { setCaseSubTab(id); setContextTask(id === 'review' ? t('ws.task.review') : t('ws.task.caseTab', { tab: t(labelKey) })); }}
            >
              <Icon size={13} /> {t(labelKey)}
            </button>
          ))}
        </nav>
      </div>

      <div className="ws-case-body">
        {caseSubTab === 'overview' && <OverviewTab caseItem={caseItem} />}
        {caseSubTab === 'graph' && (
          <div className="ws-case-graph">
            <KnowledgeGraphCanvas isAuthenticated={isAuthenticated} onShowLogin={onShowLogin} />
          </div>
        )}
        {caseSubTab === 'source' && <SourceTab caseId={caseItem.id} />}
        {caseSubTab === 'evidence' && <EvidenceTab caseItem={caseItem} />}
        {caseSubTab === 'review' && <ReviewTab caseItem={caseItem} />}
      </div>
    </div>
  );
}

// ================= 概览 =================
function OverviewTab({ caseItem }) {
  const { t } = useI18n();
  const { success: showSuccess } = useToastStore();
  const ents = caseItem.entities || [];
  const rels = caseItem.relations || [];
  const byType = useMemo(() => {
    const m = new Map();
    for (const e of ents) m.set(e.entityType || e.entity_type, (m.get(e.entityType || e.entity_type) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [ents]);

  // 复制案例 Markdown 摘要：名称/地点/年份/描述/标签/实体数
  const copyMarkdown = async () => {
    const metaLine = [caseItem.location, caseItem.year ? `${caseItem.year}${t('case.yearSuffix')}` : '']
      .filter(Boolean).join(' · ');
    const parts = [`# ${caseItem.name || ''}`];
    if (metaLine) parts.push(metaLine);
    if (caseItem.description) parts.push(caseItem.description);
    if (Array.isArray(caseItem.tags) && caseItem.tags.length > 0) {
      parts.push(caseItem.tags.map((x) => `#${x}`).join(' '));
    }
    parts.push(`${t('case.entityCount')}: ${ents.length}`);
    try {
      await navigator.clipboard.writeText(parts.join('\n\n'));
      showSuccess(t('ux.review.copied'));
    } catch (e) { /* 剪贴板不可用时静默 */ }
  };

  return (
    <div className="ws-overview">
      <div className="ws-overview-actions">
        <button className="ws-act" onClick={copyMarkdown}><ClipboardCopy size={12} /> {t('ux.review.copyMd')}</button>
      </div>
      {caseItem.description && <p className="ws-overview-desc">{caseItem.description}</p>}
      <div className="ws-stat-row">
        <div className="ws-stat"><b>{ents.length}</b><span>{t('case.entityCount')}</span></div>
        <div className="ws-stat"><b>{rels.length}</b><span>{t('case.linkCount')}</span></div>
        <div className="ws-stat"><b>{byType.length}</b><span>{t('ws.overview.typeCount')}</span></div>
      </div>
      <h4>{t('ws.overview.typeDist')}</h4>
      <div className="ws-type-grid">
        {byType.map(([t, n]) => (
          <div className="ws-type-cell" key={t}>
            <span className="ws-type-name">{t}</span>
            <span className="ws-type-count">{n}</span>
          </div>
        ))}
      </div>
      {Array.isArray(caseItem.tags) && caseItem.tags.length > 0 && (
        <div className="ws-tags">{caseItem.tags.map((t) => <span key={t} className="ws-badge na">{t}</span>)}</div>
      )}
      <p className="ws-overview-note">
        {t('ws.overview.note')}
      </p>
    </div>
  );
}

// ================= 原文与分段 =================
function SourceTab({ caseId }) {
  const { t } = useI18n();
  const [segments, setSegments] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let live = true;
    setSegments(null); setError('');
    extractionApi.getSegments(caseId)
      .then((d) => live && setSegments(d.segments || []))
      .catch((e) => live && setError(e.message));
    return () => { live = false; };
  }, [caseId]);

  const filtered = useMemo(
    () => (segments || []).filter((s) => !q || (s.content || '').includes(q)),
    [segments, q]
  );

  if (error) return <div className="ws-tab-error">{t('ws.loadFailed', { error })}</div>;
  if (!segments) return <Loading />;
  if (segments.length === 0) {
    return <div className="ws-tab-hint">{t('ws.source.empty')}</div>;
  }

  return (
    <div className="ws-source">
      <div className="ws-source-toolbar">
        <Search size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('ws.source.searchPlaceholder')} />
        <span>{t('ws.source.count', { filtered: filtered.length, total: segments.length })}</span>
      </div>
      <div className="ws-segment-list">
        {filtered.map((s) => (
          <div className="ws-segment" key={s.id}>
            <span className="ws-segment-idx">#{s.segment_index}{s.page != null ? ` · p${s.page}` : ''}</span>
            <p>{s.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= 证据 =================
function EvidenceTab({ caseItem }) {
  const { t } = useI18n();
  const { selectEntity, selectedEntityId } = useWorkspaceStore();
  const [counts, setCounts] = useState({});
  const [active, setActive] = useState(null);
  const [evidence, setEvidence] = useState(null);

  useEffect(() => {
    let live = true;
    evidenceApi.getCounts(caseItem.id)
      .then((d) => live && setCounts(d.by_entity || {}))
      .catch(() => {});
    return () => { live = false; };
  }, [caseItem.id]);

  const openEntity = useCallback(async (ent) => {
    const id = String(ent.id);
    setActive(id);
    selectEntity(id);
    setEvidence(null);
    try {
      const d = await evidenceApi.getByEntity(id);
      setEvidence(d.evidence || []);
    } catch (e) {
      setEvidence([]);
    }
  }, [selectEntity]);

  useEffect(() => {
    if (selectedEntityId && selectedEntityId !== active) {
      const ent = (caseItem.entities || []).find((e) => String(e.id) === selectedEntityId);
      if (ent) openEntity(ent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEntityId]);

  const ents = useMemo(() => {
    const list = [...(caseItem.entities || [])];
    list.sort((a, b) => (counts[String(b.id)]?.total || 0) - (counts[String(a.id)]?.total || 0));
    return list;
  }, [caseItem.entities, counts]);

  return (
    <div className="ws-evidence">
      <aside className="ws-ev-list">
        <div className="ws-ev-list-head">{t('ws.evidence.listHead')}</div>
        <div className="ws-ev-entities">
          {ents.map((e) => {
            const c = counts[String(e.id)];
            return (
              <button
                key={e.id}
                className={`ws-ev-entity ${String(active) === String(e.id) ? 'active' : ''}${!c ? ' no-ev' : ''}`}
                onClick={() => openEntity(e)}
                title={`${e.entityType || e.entity_type}`}
              >
                <span className="ws-ev-dot" style={{ background: e.color || '#94a3b8' }} />
                <span className="ws-ev-name">{e.name}</span>
                <span className="ws-ev-count">{c ? c.total : 0}</span>
              </button>
            );
          })}
        </div>
      </aside>
      <div className="ws-ev-detail">
        {!active && <div className="ws-tab-hint">{t('ws.evidence.hint')}</div>}
        {active && !evidence && <Loading />}
        {active && evidence && evidence.length === 0 && (
          <div className="ws-tab-hint">
            {t('ws.evidence.none')}
          </div>
        )}
        {active && evidence && evidence.map((ev) => (
          <div className="ws-ev-card" key={ev.id}>
            <div className="ws-ev-card-head">
              <span className={`ws-badge ${STATUS_CLASS[ev.status] || 'na'}`}>
                <ShieldCheck size={11} /> {STATUS_LABEL[ev.status] ? t(STATUS_LABEL[ev.status]) : ev.status || t('pipeline.approved')}
              </span>
              <span className="ws-ev-src">{ev.source === 'manual' ? t('ws.evidence.manual') : ev.source === 'legacy' ? t('ws.evidence.legacy') : t('ws.evidence.ai')}</span>
            </div>
            <blockquote className="ws-ev-quote">{t('ws.evidence.quote', { quote: ev.quote })}</blockquote>
            {(ev.document_title || ev.segment_content) && (
              <div className="ws-ev-loc">
                {ev.document_title && <div>📄 {ev.document_title}</div>}
                {ev.segment_index != null && <div>{t('ws.evidence.segment', { index: ev.segment_index })}{ev.page != null ? t('ws.evidence.pageSuffix', { page: ev.page }) : ''}</div>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ================= 审核 =================
function ReviewTab({ caseItem }) {
  const { t, locale } = useI18n();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null); // {type:'entity'|'relation', id, value}
  const [reason, setReason] = useState('');
  const [cursor, setCursor] = useState(0); // 键盘流：当前聚焦的待审条目下标
  const [expanded, setExpanded] = useState({}); // `${type}-${id}` -> 原文是否展开
  const reviewRef = useRef(null);

  const reload = useCallback(() => {
    reviewApi.queues(caseItem.id).then(setData).catch((e) => setError(e.message));
  }, [caseItem.id]);
  useEffect(() => { setData(null); setError(''); reload(); }, [reload]);

  const act = async (type, id, action, extra = {}) => {
    setBusyId(`${type}-${id}-${action}`);
    try {
      const api = type === 'entity' ? reviewApi.entityAction : reviewApi.relationAction;
      await api(id, action, { reason, ...extra });
      setEditing(null); setReason('');
      reload();
    } catch (e) {
      alert(t('ws.actionFailed', { error: e.message }));
    } finally {
      setBusyId(null);
    }
  };

  // 待审清单：先实体后关系（entities/relations 可能为 null）
  const pendingItems = useMemo(() => [
    ...((data && data.entities) || [])
      .filter((x) => x.status === 'pending').map((x) => ({ ...x, reviewType: 'entity' })),
    ...((data && data.relations) || [])
      .filter((x) => x.status === 'pending').map((x) => ({ ...x, reviewType: 'relation' })),
  ], [data]);
  const pendingIndex = useMemo(() => {
    const m = new Map();
    pendingItems.forEach((it, i) => m.set(`${it.reviewType}-${it.id}`, i));
    return m;
  }, [pendingItems]);
  // 进度口径：counts 中实体+关系的 confirmed / (confirmed + pending)，防御性除零
  const progressPct = useMemo(() => {
    const c = (data && data.counts) || {};
    const ent = c.entities || {};
    const rel = c.relations || {};
    const confirmed = (ent.confirmed || 0) + (rel.confirmed || 0);
    const total = confirmed + (ent.pending || 0) + (rel.pending || 0);
    return total > 0 ? Math.round((confirmed / total) * 100) : 0;
  }, [data]);

  // 待审条目增删后把光标夹回有效范围
  useEffect(() => {
    setCursor((c) => Math.min(c, Math.max(0, pendingItems.length - 1)));
  }, [pendingItems.length]);

  const scrollToCursor = useCallback(() => {
    const idx = Math.min(cursor, Math.max(0, pendingItems.length - 1));
    const root = reviewRef.current;
    const el = root && root.querySelector(`[data-idx="${idx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [cursor, pendingItems.length]);
  useEffect(() => { scrollToCursor(); }, [scrollToCursor]);

  // 全局键盘流：仅数据加载完成且无错误时挂载；输入态/编辑态/busy 中忽略
  useEffect(() => {
    if (!data || error) return undefined;
    const onKey = (e) => {
      const tg = e.target;
      if (editing || busyId) return;
      if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName || ''))) return;
      const cur = pendingItems[Math.min(cursor, Math.max(0, pendingItems.length - 1))];
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, Math.min(pendingItems.length - 1, c + (e.key === 'ArrowDown' ? 1 : -1))));
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && cur) {
        e.preventDefault();
        act(cur.reviewType, cur.id, e.key === 'ArrowRight' ? 'approve' : 'reject');
      } else if (e.key === ' ' && cur) {
        e.preventDefault();
        if (sourceTextOf(cur)) {
          setExpanded((m) => ({ ...m, [`${cur.reviewType}-${cur.id}`]: !m[`${cur.reviewType}-${cur.id}`] }));
        } else {
          scrollToCursor();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, error, editing, busyId, pendingItems, cursor, act, scrollToCursor]);

  if (error) return <div className="ws-tab-error">{t('ws.loadFailed', { error })}</div>;
  if (!data) return <Loading />;

  const { entities, relations, facts, counts } = data;
  const safeCursor = Math.min(cursor, Math.max(0, pendingItems.length - 1));
  const ActionButtons = ({ type, item }) => {
    const busy = (a) => busyId === `${type}-${item.id}-${a}`;
    return (
      <div className="ws-review-actions">
        {item.status !== 'confirmed' && (
          <button className="ws-act ok" disabled={busy('approve')} onClick={() => act(type, item.id, 'approve')}>
            {busy('approve') ? <Loader2 size={12} className="spin" /> : <Check size={12} />} {t('ws.review.approve')}
          </button>
        )}
        <button className="ws-act edit" disabled={busy('edit')}
          onClick={() => setEditing({ type, id: item.id, value: type === 'entity' ? item.name : item.relation_type })}>
          <Pencil size={12} /> {t('ws.review.edit')}
        </button>
        {item.status !== 'rejected' ? (
          <button className="ws-act bad" disabled={busy('reject')} onClick={() => act(type, item.id, 'reject')}>
            {busy('reject') ? <Loader2 size={12} className="spin" /> : <X size={12} />} {t('ws.review.reject')}
          </button>
        ) : (
          <button className="ws-act" disabled={busy('restore')} onClick={() => act(type, item.id, 'restore')}>
            <RotateCcw size={12} /> {t('ws.review.restore')}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="ws-review" ref={reviewRef}>
      <div className="ws-review-progress" title={t('ux.review.progress')}>
        <i style={{ width: `${progressPct}%` }} />
      </div>
      <div className="ws-review-hints">{t('ux.review.hints')}</div>
      <div className="ws-review-counts">
        <span className="ws-badge warn">{t('ws.review.entityPending', { count: counts.entities.pending })}</span>
        <span className="ws-badge ok">{t('ws.review.entityConfirmed', { count: counts.entities.confirmed })}</span>
        <span className="ws-badge bad">{t('ws.review.entityRejected', { count: counts.entities.rejected })}</span>
        <span className="ws-badge warn">{t('ws.review.relationPending', { count: counts.relations.pending })}</span>
        <span className="ws-badge ok">{t('ws.review.relationConfirmed', { count: counts.relations.confirmed })}</span>
        <span className="ws-badge bad">{t('ws.review.relationRejected', { count: counts.relations.rejected })}</span>
      </div>

      {editing && (
        <div className="ws-edit-bar">
          <span>{editing.type === 'entity' ? t('ws.review.editEntity') : t('ws.review.editRelation')}</span>
          <input value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
          <button className="ws-act ok" onClick={() => act(editing.type, editing.id, 'edit',
            editing.type === 'entity' ? { name: editing.value } : { relationType: editing.value })}>
            <Check size={12} /> {t('entity.save')}
          </button>
          <button className="ws-act" onClick={() => setEditing(null)}><X size={12} /> {t('common.cancel')}</button>
        </div>
      )}

      <div className="ws-review-section">
        <div className="ws-review-input">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('ws.review.reasonPlaceholder')} />
        </div>

        <h4>{t('ws.review.entitySection')}</h4>
        <div className="ws-review-list">
          {entities.map((e) => {
            const pIdx = pendingIndex.get(`entity-${e.id}`);
            const src = sourceTextOf(e);
            return (
              <div
                className={`ws-review-card ws-review-row st-${e.status}${pIdx != null && pIdx === safeCursor ? ' kbcursor' : ''}`}
                data-idx={pIdx}
                key={`e-${e.id}`}
              >
                <div className="ws-review-card-main">
                  <span className="ws-ev-dot" style={{ background: e.color || '#94a3b8' }} />
                  <b>{e.name}</b>
                  <span className="ws-review-type">{e.entity_type}</span>
                  <span className={`ws-badge ${STATUS_CLASS[e.status]}`}>{t(STATUS_LABEL[e.status])}</span>
                </div>
                <ActionButtons type="entity" item={e} />
                {src && expanded[`entity-${e.id}`] && <blockquote className="ws-ev-quote">{src}</blockquote>}
              </div>
            );
          })}
        </div>

        <h4>{t('ws.review.relationSection')}</h4>
        <div className="ws-review-list">
          {relations.map((r) => {
            const pIdx = pendingIndex.get(`relation-${r.id}`);
            const src = sourceTextOf(r);
            return (
              <div
                className={`ws-review-card ws-review-row st-${r.status}${pIdx != null && pIdx === safeCursor ? ' kbcursor' : ''}`}
                data-idx={pIdx}
                key={`r-${r.id}`}
              >
                <div className="ws-review-card-main">
                  <b>{r.source_name || '?'}</b>
                  <span className="ws-review-rel">—{r.relation_type}→</span>
                  <b>{r.target_name || '?'}</b>
                  <span className={`ws-badge ${STATUS_CLASS[r.status]}`}>{t(STATUS_LABEL[r.status])}</span>
                </div>
                <ActionButtons type="relation" item={r} />
                {src && expanded[`relation-${r.id}`] && <blockquote className="ws-ev-quote">{src}</blockquote>}
              </div>
            );
          })}
        </div>

        <h4>{t('ws.review.factsSection')}</h4>
        <div className="ws-fact-list">
          {facts.map((f) => (
            <div className="ws-fact" key={f.id}>
              <p>{f.fact_text}</p>
              <div className="ws-fact-meta">
                <span className={`ws-badge ${f.status === 'confirmed' ? 'ok' : 'na'}`}>{STATUS_LABEL[f.status] ? t(STATUS_LABEL[f.status]) : f.status}</span>
                {f.fact_type && <span className="ws-fact-type">{f.fact_type}</span>}
                {f.metadata?.source_refs?.length > 0 && (
                  <span className="ws-fact-srcs">{t('ws.review.sources', { refs: f.metadata.source_refs.join(locale === 'en' ? ', ' : '、') })}</span>
                )}
              </div>
            </div>
          ))}
          {facts.length === 0 && <div className="ws-tab-hint">{t('ws.review.noFacts')}</div>}
        </div>
      </div>
    </div>
  );
}

function Loading() {
  const { t } = useI18n();
  return <div className="ws-loading"><Loader2 size={18} className="spin" /> {t('compare.loading')}</div>;
}
