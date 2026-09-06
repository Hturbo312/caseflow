import { useState, useEffect, useCallback } from 'react';
import { GitBranch, Loader2, Plus, X, Check, Lock, Archive, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { schemaVersionApi } from '../../../../services/api';
import { useAuthStore } from '../../../../store';
import { useI18n } from '../../../../i18n';

const STATUS_BADGE = {
  active: { label: 'v2.version.inUse', cls: 'ok' },
  draft: { label: 'v2.version.draft', cls: 'warn' },
  frozen: { label: 'v2.version.frozen', cls: 'na' },
  archived: { label: 'v2.version.archived', cls: 'na' },
};

/**
 * Schema 版本栏（Spec §5.2 / §6.1）
 * 版本列表与状态、创建草案、版本差异、影响分析、批准/冻结/归档。
 * AI 建议不在此自动发布；一切版本变更为研究者手动操作。
 */
export default function VersionBar({ schemaId }) {
  const { t } = useI18n();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [family, setFamily] = useState(null);
  const [versions, setVersions] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState(null); // {type:'diff'|'impact'|'log', data}
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ versionKey: '', researchQuestion: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const famRes = await schemaVersionApi.families();
      const fam = (famRes.families || []).find((f) => f.key === 'thesis_dynamic_schema') || famRes.families?.[0];
      setFamily(fam || null);
      if (fam) {
        const verRes = await schemaVersionApi.versions(fam.id);
        setVersions(verRes.versions || []);
      }
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn, versionId) => {
    setBusy(true); setError('');
    try {
      await fn(versionId);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const createDraft = async () => {
    if (!form.versionKey.trim()) return;
    setBusy(true); setError('');
    try {
      await schemaVersionApi.createDraft({
        familyId: family.id,
        versionKey: form.versionKey.trim(),
        researchQuestion: form.researchQuestion.trim(),
      });
      setCreating(false);
      setForm({ versionKey: '', researchQuestion: '' });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const showPanel = async (type, versionId) => {
    setBusy(true); setError('');
    try {
      const data = type === 'diff' ? await schemaVersionApi.diff(versionId)
        : type === 'impact' ? await schemaVersionApi.impact(versionId)
        : await schemaVersionApi.changeLog(versionId);
      setPanel({ type, data });
      setExpanded(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!family) return null;
  const active = versions.find((v) => v.status === 'active');

  return (
    <div className="ws-versionbar">
      <div className="ws-versionbar-row">
        <GitBranch size={13} />
        <span className="ws-versionbar-title">{t('v2.version.title')}</span>
        {active && <span className={`ws-badge ${STATUS_BADGE.active.cls}`}>{active.version_key} {t('v2.version.inUse')}</span>}
        <button className="ws-versionbar-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? t('v2.version.collapse') : t('v2.version.allCount', { count: versions.length })}
        </button>
        {isAuthenticated && (
          <button className="ws-versionbar-new" onClick={() => setCreating(!creating)} title={t('v2.version.newDraftTitle')}>
            <Plus size={12} /> {t('v2.version.newDraft')}
          </button>
        )}
      </div>

      {creating && (
        <div className="ws-versionbar-form">
          <input placeholder={t('v2.version.keyPlaceholder')} value={form.versionKey}
            onChange={(e) => setForm({ ...form, versionKey: e.target.value })} />
          <input placeholder={t('v2.version.rqPlaceholder')} value={form.researchQuestion}
            onChange={(e) => setForm({ ...form, researchQuestion: e.target.value })} />
          <button className="ws-act ok" disabled={busy || !form.versionKey.trim()} onClick={createDraft}>
            {busy ? <Loader2 size={12} className="spin" /> : <Check size={12} />} {t('v2.version.create')}
          </button>
          <button className="ws-act" onClick={() => setCreating(false)}><X size={12} /> {t('common.cancel')}</button>
        </div>
      )}

      {error && <div className="ws-versionbar-error"><AlertTriangle size={11} /> {error}</div>}

      {expanded && (
        <div className="ws-versionbar-body">
          {versions.map((v) => (
            <div className="ws-version-item" key={v.id}>
              <b>{v.version_key}</b>
              <span className={`ws-badge ${STATUS_BADGE[v.status]?.cls || 'na'}`}>{t(STATUS_BADGE[v.status]?.label) || v.status}</span>
              {v.research_question && <span className="ws-version-rq" title={v.research_question}>{v.research_question}</span>}
              <span className="ws-version-actions">
                <button className="ws-act" disabled={busy} onClick={() => showPanel('diff', v.id)}>{t('v2.version.diff')}</button>
                <button className="ws-act" disabled={busy} onClick={() => showPanel('impact', v.id)}>{t('v2.version.impact')}</button>
                <button className="ws-act" disabled={busy} onClick={() => showPanel('log', v.id)}>{t('v2.version.log')}</button>
                {isAuthenticated && v.status === 'draft' && (
                  <button className="ws-act ok" disabled={busy} onClick={() => act(schemaVersionApi.approve, v.id)} title={t('v2.version.approveTitle')}>
                    <Check size={11} /> {t('v2.version.approve')}
                  </button>
                )}
                {isAuthenticated && (v.status === 'draft' || v.status === 'active') && (
                  <button className="ws-act" disabled={busy} onClick={() => act(schemaVersionApi.freeze, v.id)} title={t('v2.version.freezeTitle')}>
                    <Lock size={11} /> {t('v2.version.freeze')}
                  </button>
                )}
                {isAuthenticated && v.status !== 'archived' && (
                  <button className="ws-act bad" disabled={busy} onClick={() => act(schemaVersionApi.archive, v.id)}>
                    <Archive size={11} /> {t('v2.version.archive')}
                  </button>
                )}
              </span>
            </div>
          ))}

          {panel?.type === 'diff' && (
            <DiffPanel data={panel.data} onClose={() => setPanel(null)} />
          )}
          {panel?.type === 'impact' && (
            <div className="ws-version-panel">
              <div className="ws-version-panel-head">{t('v2.version.impactTitle')}<button onClick={() => setPanel(null)}><X size={12} /></button></div>
              <div className="ws-version-panel-body">
                <div className="ws-stat-row">
                  <div className="ws-stat"><b>{panel.data.affected_cases}</b><span>{t('v2.version.affectedCases')}</span></div>
                  <div className="ws-stat"><b>{panel.data.typed_entities}</b><span>{t('v2.version.typedEntities')}</span></div>
                  <div className="ws-stat"><b>{panel.data.typed_relations}</b><span>{t('v2.version.typedRelations')}</span></div>
                  <div className="ws-stat"><b>{panel.data.fact_assertions?.pending ?? 0}</b><span>{t('v2.version.pendingFacts')}</span></div>
                </div>
                <p className="ws-version-note">{t('v2.version.impactNote', { status: panel.data.status })}</p>
              </div>
            </div>
          )}
          {panel?.type === 'log' && (
            <div className="ws-version-panel">
              <div className="ws-version-panel-head">{t('v2.version.changeLog')}<button onClick={() => setPanel(null)}><X size={12} /></button></div>
              <div className="ws-version-panel-body">
                {panel.data.changes.map((c) => (
                  <div className="ws-version-log-row" key={c.id}>
                    <span className="ws-version-log-type">{c.change_type}</span>
                    <span>{c.target_key}</span>
                    <span className="ws-version-log-meta">{c.creator || t('v2.version.bySystem')} · {new Date(c.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                ))}
                {panel.data.changes.length === 0 && <div className="ws-tab-hint">{t('v2.version.noChanges')}</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiffPanel({ data, onClose }) {
  const { t } = useI18n();
  const et = data.entity_types || {};
  const rl = data.relations || {};
  const empty = !et.added?.length && !et.removed?.length && !et.renamed?.length &&
    !rl.added?.length && !rl.removed?.length && !rl.direction_changed?.length;
  return (
    <div className="ws-version-panel">
      <div className="ws-version-panel-head">
        <ArrowLeftRight size={12} /> {t('v2.version.diffTitle', { versions: data.parent_version ? `${data.parent_version} → ${data.version_key}` : data.version_key })}
        <button onClick={onClose}><X size={12} /></button>
      </div>
      <div className="ws-version-panel-body">
        {empty && <div className="ws-tab-hint">{t('v2.version.noDiff')}</div>}
        {et.added?.length > 0 && <div className="ws-diff-row"><span className="ws-badge ok">{t('v2.version.addedTypes')}</span>{et.added.map((x) => <span key={x.stable_key} className="ws-diff-item">{x.name}</span>)}</div>}
        {et.removed?.length > 0 && <div className="ws-diff-row"><span className="ws-badge bad">{t('v2.version.removedTypes')}</span>{et.removed.map((x) => <span key={x.stable_key} className="ws-diff-item">{x.name}</span>)}</div>}
        {et.renamed?.length > 0 && <div className="ws-diff-row"><span className="ws-badge warn">{t('v2.version.renamed')}</span>{et.renamed.map((x) => <span key={x.stable_key} className="ws-diff-item">{x.from} → {x.to}</span>)}</div>}
        {rl.added?.length > 0 && <div className="ws-diff-row"><span className="ws-badge ok">{t('v2.version.addedRelations')}</span>{rl.added.map((x) => <span key={x.stable_key} className="ws-diff-item">{x.name}</span>)}</div>}
        {rl.removed?.length > 0 && <div className="ws-diff-row"><span className="ws-badge bad">{t('v2.version.removedRelations')}</span>{rl.removed.map((x) => <span key={x.stable_key} className="ws-diff-item">{x.name}</span>)}</div>}
        {rl.direction_changed?.length > 0 && <div className="ws-diff-row"><span className="ws-badge warn">{t('v2.version.directionChanged')}</span>{rl.direction_changed.map((x) => <span key={x.stable_key} className="ws-diff-item">{x.name}: {x.from} → {x.to}</span>)}</div>}
      </div>
    </div>
  );
}
