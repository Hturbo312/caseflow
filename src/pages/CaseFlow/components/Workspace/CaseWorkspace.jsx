import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText, ShieldCheck, ClipboardCheck, Layers, Search, Share2,
  Check, X, RotateCcw, Pencil, Quote, Loader2, MousePointerClick,
} from 'lucide-react';
import { useCaseStore, useSchemaStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { evidenceApi, reviewApi, extractionApi } from '../../../../services/api';
import KnowledgeGraphCanvas from '../KnowledgeGraphCanvas';

const SUB_TABS = [
  { id: 'overview', label: '概览', icon: Layers },
  { id: 'graph', label: '图谱', icon: Share2 },
  { id: 'source', label: '原文与分段', icon: FileText },
  { id: 'evidence', label: '证据', icon: Quote },
  { id: 'review', label: '审核', icon: ClipboardCheck },
];

const STATUS_LABEL = {
  confirmed: '已确认', limited: '有限支持', blocked: '受阻', not_evidenced: '资料未说明',
  pending: '待审核', rejected: '已拒绝',
};
const STATUS_CLASS = {
  confirmed: 'ok', limited: 'warn', blocked: 'bad', not_evidenced: 'na',
  pending: 'warn', rejected: 'bad',
};
const CASE_STATUS_LABEL = { core: '核心', candidate: '候选', boundary: '边界', experiment: '实验' };

export default function CaseWorkspace({ onShowLogin, isAuthenticated }) {
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
        <p>在右侧案例库中单击案例</p>
        <span>案例详情将在中栏打开（概览 / 原文与分段 / 证据 / 审核）</span>
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
              {CASE_STATUS_LABEL[caseItem.case_status] || caseItem.case_status}
            </span>
          )}
        </div>
        <div className="ws-case-sub">
          {[caseItem.location, caseItem.year && `${caseItem.year}年`, schema?.name]
            .filter(Boolean).join(' ｜ ')}
        </div>
        <nav className="ws-subtabs">
          {SUB_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={caseSubTab === id ? 'active' : ''}
              onClick={() => { setCaseSubTab(id); setContextTask(label === '审核' ? '关系/实体审核' : `案例${label}`); }}
            >
              <Icon size={13} /> {label}
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
  const ents = caseItem.entities || [];
  const rels = caseItem.relations || [];
  const byType = useMemo(() => {
    const m = new Map();
    for (const e of ents) m.set(e.entityType || e.entity_type, (m.get(e.entityType || e.entity_type) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [ents]);

  return (
    <div className="ws-overview">
      {caseItem.description && <p className="ws-overview-desc">{caseItem.description}</p>}
      <div className="ws-stat-row">
        <div className="ws-stat"><b>{ents.length}</b><span>实体</span></div>
        <div className="ws-stat"><b>{rels.length}</b><span>关系</span></div>
        <div className="ws-stat"><b>{byType.length}</b><span>对象类别</span></div>
      </div>
      <h4>知识对象分布</h4>
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
        概念映射与时间线视图将在 P2 阶段提供；当前版本的证据与审核数据可在对应子页查看。
      </p>
    </div>
  );
}

// ================= 原文与分段 =================
function SourceTab({ caseId }) {
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

  if (error) return <div className="ws-tab-error">加载失败：{error}</div>;
  if (!segments) return <Loading />;
  if (segments.length === 0) {
    return <div className="ws-tab-hint">该案例尚未导入原文分段。可在「AI 抽取」流程中解析文本，或等待案例库批量导入。</div>;
  }

  return (
    <div className="ws-source">
      <div className="ws-source-toolbar">
        <Search size={14} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="在分段中搜索…" />
        <span>{filtered.length} / {segments.length} 段</span>
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
        <div className="ws-ev-list-head">实体（按证据数排序）</div>
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
        {!active && <div className="ws-tab-hint">点击左侧实体查看其证据链（逐字引文 + 文档定位）。</div>}
        {active && !evidence && <Loading />}
        {active && evidence && evidence.length === 0 && (
          <div className="ws-tab-hint">
            该实体暂无证据记录。导入案例的实体均应有证据；若缺失请在审核页拒绝或补充。
          </div>
        )}
        {active && evidence && evidence.map((ev) => (
          <div className="ws-ev-card" key={ev.id}>
            <div className="ws-ev-card-head">
              <span className={`ws-badge ${STATUS_CLASS[ev.status] || 'na'}`}>
                <ShieldCheck size={11} /> {STATUS_LABEL[ev.status] || ev.status || '已确认'}
              </span>
              <span className="ws-ev-src">{ev.source === 'manual' ? '人工导入' : ev.source === 'legacy' ? '存量' : 'AI抽取'}</span>
            </div>
            <blockquote className="ws-ev-quote">「{ev.quote}」</blockquote>
            {(ev.document_title || ev.segment_content) && (
              <div className="ws-ev-loc">
                {ev.document_title && <div>📄 {ev.document_title}</div>}
                {ev.segment_index != null && <div>段落 #{ev.segment_index}{ev.page != null ? ` · 第 ${ev.page} 页` : ''}</div>}
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
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState(null); // {type:'entity'|'relation', id, value}
  const [reason, setReason] = useState('');

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
      alert(`操作失败：${e.message}`);
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <div className="ws-tab-error">加载失败：{error}</div>;
  if (!data) return <Loading />;

  const { entities, relations, facts, counts } = data;
  const ActionButtons = ({ type, item }) => {
    const busy = (a) => busyId === `${type}-${item.id}-${a}`;
    return (
      <div className="ws-review-actions">
        {item.status !== 'confirmed' && (
          <button className="ws-act ok" disabled={busy('approve')} onClick={() => act(type, item.id, 'approve')}>
            {busy('approve') ? <Loader2 size={12} className="spin" /> : <Check size={12} />} 通过
          </button>
        )}
        <button className="ws-act edit" disabled={busy('edit')}
          onClick={() => setEditing({ type, id: item.id, value: type === 'entity' ? item.name : item.relation_type })}>
          <Pencil size={12} /> 编辑
        </button>
        {item.status !== 'rejected' ? (
          <button className="ws-act bad" disabled={busy('reject')} onClick={() => act(type, item.id, 'reject')}>
            {busy('reject') ? <Loader2 size={12} className="spin" /> : <X size={12} />} 拒绝
          </button>
        ) : (
          <button className="ws-act" disabled={busy('restore')} onClick={() => act(type, item.id, 'restore')}>
            <RotateCcw size={12} /> 恢复
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="ws-review">
      <div className="ws-review-counts">
        <span className="ws-badge warn">实体待审 {counts.entities.pending}</span>
        <span className="ws-badge ok">实体已确认 {counts.entities.confirmed}</span>
        <span className="ws-badge bad">实体已拒绝 {counts.entities.rejected}</span>
        <span className="ws-badge warn">关系待审 {counts.relations.pending}</span>
        <span className="ws-badge ok">关系已确认 {counts.relations.confirmed}</span>
        <span className="ws-badge bad">关系已拒绝 {counts.relations.rejected}</span>
      </div>

      {editing && (
        <div className="ws-edit-bar">
          <span>编辑{editing.type === 'entity' ? '实体' : '关系'}名称/类型：</span>
          <input value={editing.value} onChange={(e) => setEditing({ ...editing, value: e.target.value })} />
          <button className="ws-act ok" onClick={() => act(editing.type, editing.id, 'edit',
            editing.type === 'entity' ? { name: editing.value } : { relationType: editing.value })}>
            <Check size={12} /> 保存
          </button>
          <button className="ws-act" onClick={() => setEditing(null)}><X size={12} /> 取消</button>
        </div>
      )}

      <div className="ws-review-section">
        <div className="ws-review-input">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="审核原因（可选，记入审核日志）" />
        </div>

        <h4>实体审核</h4>
        <div className="ws-review-list">
          {entities.map((e) => (
            <div className={`ws-review-card st-${e.status}`} key={`e-${e.id}`}>
              <div className="ws-review-card-main">
                <span className="ws-ev-dot" style={{ background: e.color || '#94a3b8' }} />
                <b>{e.name}</b>
                <span className="ws-review-type">{e.entity_type}</span>
                <span className={`ws-badge ${STATUS_CLASS[e.status]}`}>{STATUS_LABEL[e.status]}</span>
              </div>
              <ActionButtons type="entity" item={e} />
            </div>
          ))}
        </div>

        <h4>关系审核</h4>
        <div className="ws-review-list">
          {relations.map((r) => (
            <div className={`ws-review-card st-${r.status}`} key={`r-${r.id}`}>
              <div className="ws-review-card-main">
                <b>{r.source_name || '?'}</b>
                <span className="ws-review-rel">—{r.relation_type}→</span>
                <b>{r.target_name || '?'}</b>
                <span className={`ws-badge ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
              </div>
              <ActionButtons type="relation" item={r} />
            </div>
          ))}
        </div>

        <h4>原子事实（L1）</h4>
        <div className="ws-fact-list">
          {facts.map((f) => (
            <div className="ws-fact" key={f.id}>
              <p>{f.fact_text}</p>
              <div className="ws-fact-meta">
                <span className={`ws-badge ${f.status === 'confirmed' ? 'ok' : 'na'}`}>{STATUS_LABEL[f.status] || f.status}</span>
                {f.fact_type && <span className="ws-fact-type">{f.fact_type}</span>}
                {f.metadata?.source_refs?.length > 0 && (
                  <span className="ws-fact-srcs">来源：{f.metadata.source_refs.join('、')}</span>
                )}
              </div>
            </div>
          ))}
          {facts.length === 0 && <div className="ws-tab-hint">暂无原子事实。</div>}
        </div>
      </div>
    </div>
  );
}

function Loading() {
  return <div className="ws-loading"><Loader2 size={18} className="spin" /> 加载中…</div>;
}
