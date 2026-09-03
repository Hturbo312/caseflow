import { useState, useEffect, useCallback } from 'react';
import { GitBranch, Loader2, Plus, X, Check, Lock, Archive, ArrowLeftRight, AlertTriangle } from 'lucide-react';
import { schemaVersionApi } from '../../../../services/api';
import { useAuthStore } from '../../../../store';

const STATUS_BADGE = {
  active: { label: '使用中', cls: 'ok' },
  draft: { label: '草案', cls: 'warn' },
  frozen: { label: '已冻结', cls: 'na' },
  archived: { label: '已归档', cls: 'na' },
};

/**
 * Schema 版本栏（Spec §5.2 / §6.1）
 * 版本列表与状态、创建草案、版本差异、影响分析、批准/冻结/归档。
 * AI 建议不在此自动发布；一切版本变更为研究者手动操作。
 */
export default function VersionBar({ schemaId }) {
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
        <span className="ws-versionbar-title">Schema 版本</span>
        {active && <span className={`ws-badge ${STATUS_BADGE.active.cls}`}>{active.version_key} 使用中</span>}
        <button className="ws-versionbar-toggle" onClick={() => setExpanded(!expanded)}>
          {expanded ? '收起' : `全部 ${versions.length} 个版本`}
        </button>
        {isAuthenticated && (
          <button className="ws-versionbar-new" onClick={() => setCreating(!creating)} title="创建新草案">
            <Plus size={12} /> 新草案
          </button>
        )}
      </div>

      {creating && (
        <div className="ws-versionbar-form">
          <input placeholder="版本号（如 v1.1）" value={form.versionKey}
            onChange={(e) => setForm({ ...form, versionKey: e.target.value })} />
          <input placeholder="研究问题（可选）" value={form.researchQuestion}
            onChange={(e) => setForm({ ...form, researchQuestion: e.target.value })} />
          <button className="ws-act ok" disabled={busy || !form.versionKey.trim()} onClick={createDraft}>
            {busy ? <Loader2 size={12} className="spin" /> : <Check size={12} />} 创建（克隆当前类型）
          </button>
          <button className="ws-act" onClick={() => setCreating(false)}><X size={12} /> 取消</button>
        </div>
      )}

      {error && <div className="ws-versionbar-error"><AlertTriangle size={11} /> {error}</div>}

      {expanded && (
        <div className="ws-versionbar-body">
          {versions.map((v) => (
            <div className="ws-version-item" key={v.id}>
              <b>{v.version_key}</b>
              <span className={`ws-badge ${STATUS_BADGE[v.status]?.cls || 'na'}`}>{STATUS_BADGE[v.status]?.label || v.status}</span>
              {v.research_question && <span className="ws-version-rq" title={v.research_question}>{v.research_question}</span>}
              <span className="ws-version-actions">
                <button className="ws-act" disabled={busy} onClick={() => showPanel('diff', v.id)}>差异</button>
                <button className="ws-act" disabled={busy} onClick={() => showPanel('impact', v.id)}>影响</button>
                <button className="ws-act" disabled={busy} onClick={() => showPanel('log', v.id)}>日志</button>
                {isAuthenticated && v.status === 'draft' && (
                  <button className="ws-act ok" disabled={busy} onClick={() => act(schemaVersionApi.approve, v.id)} title="发布为使用中版本">
                    <Check size={11} /> 批准
                  </button>
                )}
                {isAuthenticated && (v.status === 'draft' || v.status === 'active') && (
                  <button className="ws-act" disabled={busy} onClick={() => act(schemaVersionApi.freeze, v.id)} title="冻结为只读">
                    <Lock size={11} /> 冻结
                  </button>
                )}
                {isAuthenticated && v.status !== 'archived' && (
                  <button className="ws-act bad" disabled={busy} onClick={() => act(schemaVersionApi.archive, v.id)}>
                    <Archive size={11} /> 归档
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
              <div className="ws-version-panel-head">影响分析（发布前必读）<button onClick={() => setPanel(null)}><X size={12} /></button></div>
              <div className="ws-version-panel-body">
                <div className="ws-stat-row">
                  <div className="ws-stat"><b>{panel.data.affected_cases}</b><span>受影响案例</span></div>
                  <div className="ws-stat"><b>{panel.data.typed_entities}</b><span>已类型化实体</span></div>
                  <div className="ws-stat"><b>{panel.data.typed_relations}</b><span>已类型化关系</span></div>
                  <div className="ws-stat"><b>{panel.data.fact_assertions?.pending ?? 0}</b><span>待重映射事实</span></div>
                </div>
                <p className="ws-version-note">状态：{panel.data.status}。发布（批准）后案例与类型外键将迁移到本版本。</p>
              </div>
            </div>
          )}
          {panel?.type === 'log' && (
            <div className="ws-version-panel">
              <div className="ws-version-panel-head">变更日志<button onClick={() => setPanel(null)}><X size={12} /></button></div>
              <div className="ws-version-panel-body">
                {panel.data.changes.map((c) => (
                  <div className="ws-version-log-row" key={c.id}>
                    <span className="ws-version-log-type">{c.change_type}</span>
                    <span>{c.target_key}</span>
                    <span className="ws-version-log-meta">{c.creator || '系统'} · {new Date(c.created_at).toLocaleString('zh-CN')}</span>
                  </div>
                ))}
                {panel.data.changes.length === 0 && <div className="ws-tab-hint">暂无变更记录。</div>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DiffPanel({ data, onClose }) {
  const et = data.entity_types || {};
  const rl = data.relations || {};
  const empty = !et.added?.length && !et.removed?.length && !et.renamed?.length &&
    !rl.added?.length && !rl.removed?.length && !rl.direction_changed?.length;
  return (
    <div className="ws-version-panel">
      <div className="ws-version-panel-head">
        <ArrowLeftRight size={12} /> 版本差异：{data.parent_version ? `${data.parent_version} → ${data.version_key}` : data.version_key}
        <button onClick={onClose}><X size={12} /></button>
      </div>
      <div className="ws-version-panel-body">
        {empty && <div className="ws-tab-hint">与父版本无结构差异。</div>}
        {et.added?.length > 0 && <div className="ws-diff-row"><span className="ws-badge ok">新增类型</span>{et.added.map((x) => <span key={x.stable_key} className="ws-diff-item">{x.name}</span>)}</div>}
        {et.removed?.length > 0 && <div className="ws-diff-row"><span className="ws-badge bad">移除类型</span>{et.removed.map((x) => <span key={x.stable_key} className="ws-diff-item">{x.name}</span>)}</div>}
        {et.renamed?.length > 0 && <div className="ws-diff-row"><span className="ws-badge warn">更名</span>{et.renamed.map((x) => <span key={x.stable_key} className="ws-diff-item">{x.from} → {x.to}</span>)}</div>}
        {rl.added?.length > 0 && <div className="ws-diff-row"><span className="ws-badge ok">新增关系</span>{rl.added.map((x) => <span key={x.stable_key} className="ws-diff-item">{x.name}</span>)}</div>}
        {rl.removed?.length > 0 && <div className="ws-diff-row"><span className="ws-badge bad">移除关系</span>{rl.removed.map((x) => <span key={x.stable_key} className="ws-diff-item">{x.name}</span>)}</div>}
        {rl.direction_changed?.length > 0 && <div className="ws-diff-row"><span className="ws-badge warn">方向变化</span>{rl.direction_changed.map((x) => <span key={x.stable_key} className="ws-diff-item">{x.name}: {x.from} → {x.to}</span>)}</div>}
      </div>
    </div>
  );
}
