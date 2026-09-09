import { useState, useEffect, useCallback } from 'react';
import { useCaseStore, useSchemaStore, useAuthStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import { aiApi, schemaVersionApi } from '../../../../services/api';
import SchemaArchitect from '../SchemaArchitect';
import SchemaVisualization from '../SchemaArchitect/SchemaVisualization';
import './framework-guide.css';

export function ResearchLens({ caseItem }) {
  const schema = useSchemaStore(s => s.schemas.find(x => String(x.id) === String(caseItem.schemaId || caseItem.schema_id)));
  const [selected, setSelected] = useState(null);
  return <div className="academic-lens"><strong>研究视角</strong><span>用于理解材料，允许暂不归类</span>
    <div>{(schema?.entityTypes || []).map(type => <button key={type.id} aria-pressed={selected?.id === type.id} onClick={() => setSelected(selected?.id === type.id ? null : type)}>{type.name}</button>)}</div>
    {selected && <section><b>{selected.name}</b><p>{selected.description || '尚未填写定义，可在研究框架中补充识别依据。'}</p><p>本案例对应记录：{(caseItem.entities || []).filter(e => (e.entityType || e.entity_type) === selected.name).map(e => e.name).join('、') || '暂未关联，不代表该现象未发生'}</p><button onClick={() => useWorkspaceStore.getState().setMainTab('schema')}>查看完整研究框架</button></section>}
  </div>;
}

/**
 * 研究框架视图（2026-09 重构）
 * 图为核心操作面：点节点 → 下方实体面板（定义/证据/修订）；点连线 → 关系面板（编辑）。
 * 未选中时面板显示框架简介与实体/关系统计。
 * 顶部：版本状态条（框架切换器 + 版本状态 + 历史与差异抽屉）。
 * 冻结/归档版本由后端 guardVersionWritable 拒绝写入。
 */
export default function FrameworkGuide(props) {
  const { schemas, currentSchemaId } = useSchemaStore();
  const cases = useCaseStore(s => s.cases);
  const userId = useAuthStore(s => s.user?.id || 'guest');
  const schema = schemas.find(s => String(s.id) === String(currentSchemaId));
  return <GuideSession key={`${userId}:${currentSchemaId}`} {...props} schema={schema} cases={cases} />;
}

const VER_STATUS_LABEL = { active: '生效中', draft: '草案', frozen: '已冻结', archived: '已归档' };

function GuideSession({ schema, cases, ...props }) {
  const { schemas, setCurrentSchema } = useSchemaStore();
  const [type, setType] = useState(null);            // 选中的概念（由图节点点击驱动）
  const [revising, setRevising] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [tidySignal, setTidySignal] = useState(0);
  const [layoutPlan, setLayoutPlan] = useState(null);
  const [aiLayingOut, setAiLayingOut] = useState(false);
  const [relEditing, setRelEditing] = useState(null);
  const [verInfo, setVerInfo] = useState(null);
  const [versions, setVersions] = useState([]);
  const [draft, setDraft] = useState({ name: '', description: '' });
  const [relDraft, setRelDraft] = useState({ name: '', from: '', to: '' });
  const [aiBusy, setAiBusy] = useState(false);
  const [aiProposals, setAiProposals] = useState(null);
  const [aiError, setAiError] = useState('');
  const [message, setMessage] = useState('');
  const types = schema?.entityTypes || [];
  const relations = schema?.relations || [];
  const active = type;                                // 仅由图节点点击选中，无默认兜底
  const matching = cases.filter(c => String(c.schemaId || c.schema_id) === String(schema?.id));
  const instances = active ? matching.flatMap(c => (c.entities || []).filter(e => (e.entityType || e.entity_type) === active.name).map(e => ({ c, e }))) : [];
  const relatedRelations = active ? relations.filter(r => r.from === active.name || r.to === active.name) : [];

  // 版本状态与更改历史（轻量读取，与版本管理同源 API）
  const loadVersionInfo = useCallback(async () => {
    try {
      const famRes = await schemaVersionApi.families();
      const fam = (famRes.families || []).find(f => Number(f.legacy_schema_id) === Number(schema?.id));
      if (!fam) { setVersions([]); return setVerInfo(null); }
      const verRes = await schemaVersionApi.versions(fam.id);
      const vs = verRes.versions || [];
      setVersions(vs);
      const cur = vs.find(v => v.status === 'active') || vs.find(v => v.status === 'draft') || vs[0];
      setVerInfo(cur ? { key: cur.version_key, status: cur.status } : null);
    } catch { setVersions([]); setVerInfo(null); }
  }, []);
  useEffect(() => { loadVersionInfo(); }, [loadVersionInfo, schema?.id]);

  function selectType(t) {
    setType(t);
    setRevising(false);
    setAiProposals(null);
    setAiError('');
    setMessage('');
    setRelEditing(null);
  }

  function startRevise() {
    setDraft({ name: active?.name || '', description: active?.description || '' });
    setRelDraft({ name: '', from: active?.name || '', to: '' });
    setAiProposals(null);
    setMessage('');
    setRevising(true);
  }

  function switchSchema(id) {
    if (!id) return;
    setCurrentSchema(id);
    setType(null);
    setRevising(false);
    setAdvanced(false);
    setAiProposals(null);
    setRelEditing(null);
    setMessage('');
  }

  // 人工修订：概念名称/定义就地保存（冻结/归档版本由后端拒绝）
  async function saveEdit() {
    if (!draft.name.trim()) return setMessage('概念名称不能为空。');
    setMessage('');
    await useSchemaStore.getState().updateEntityType(schema.id, active.id, { name: draft.name.trim(), description: draft.description });
    setRevising(false);
    setMessage('修订已保存。重大结构调整建议创建新版本草案（顶部「历史与差异」）后批量进行。');
    loadVersionInfo();
  }

  async function addConcept() {
    const created = await useSchemaStore.getState().addEntityType(schema.id, { name: `新概念 ${types.length + 1}`, color: '#9ca3af', description: '' });
    setType(created);
    setDraft({ name: created.name, description: '' });
    setRevising(true);
  }

  // 图节点悬停 × 直接删除（带确认）；面板内「删除此概念」仍走 removeConcept
  async function deleteConceptById(nodeId) {
    const t = types.find(x => String(x.id) === String(nodeId));
    if (!t) return;
    if (!window.confirm(`删除概念「${t.name}」？已归入该概念的案例实体记录不会删除，但会失去类型归属。`)) return;
    await useSchemaStore.getState().deleteEntityType(schema.id, t.id);
    if (active && String(active.id) === String(nodeId)) { setType(null); setRevising(false); }
    setMessage(`概念「${t.name}」已删除。`);
  }

  async function removeConcept() {
    if (!window.confirm(`删除概念「${active?.name}」？已归入该概念的案例实体记录不会删除，但会失去类型归属。`)) return;
    await useSchemaStore.getState().deleteEntityType(schema.id, active.id);
    setType(null);
    setRevising(false);
    setMessage('概念已删除。');
  }

  async function addRelation() {
    if (!relDraft.name.trim() || !relDraft.from || !relDraft.to) return setMessage('关系名、起点与终点概念均需填写。');
    await useSchemaStore.getState().addRelation(schema.id, { name: relDraft.name.trim(), from: relDraft.from, to: relDraft.to, description: '' });
    setRelDraft({ name: '', from: active?.name || '', to: '' });
    setMessage('关系已添加。');
  }

  // 工具栏「＋ 关系」：直接打开下方关系面板的创建模式
  function startAddRelation() {
    if (!types.length) return setMessage('请先创建实体概念，再建立关系。');
    const first = active?.name || types[0]?.name || '';
    setRevising(false);
    setAiProposals(null);
    setAiError('');
    setMessage('');
    setRelEditing({ name: '', from: first, to: first, description: '', __new: true });
  }

  // 画布拖线 → 直接创建关系（默认名「关联」，随后可在关系面板中改名）
  async function handleGraphConnect({ sourceName, targetName }) {
    if (!sourceName || !targetName) return;
    const nr = await useSchemaStore.getState().addRelation(schema.id, { name: '关联', from: sourceName, to: targetName, description: '' });
    if (nr) {
      setRevising(false);
      setRelEditing({ ...nr });
      setMessage('已创建关系。请在下方面板中命名，回图可继续拖线。');
    }
  }

  // 画布中选中连线按 Delete → 删除关系（同步服务器）
  async function handleGraphEdgeDelete(ids) {
    if (!ids.length) return;
    if (!window.confirm(`确认删除 ${ids.length} 条关系？此操作会同步到服务器。`)) return;
    for (const id of ids) {
      const r = relations.find(x => String(x.id) === String(id));
      if (r) await useSchemaStore.getState().deleteRelation(schema.id, r.id);
    }
    setRelEditing(null);
    setMessage('关系已删除。');
  }

  async function removeRelation(r) {
    await useSchemaStore.getState().deleteRelation(schema.id, r.id);
    setMessage(`关系「${r.name}」已删除。`);
  }

  // AI 排布：把概念/关系清单交给 AI 出分行方案（只影响排版，不写入数据）
  async function aiLayout() {
    if (!types.length || aiLayingOut) return;
    setAiLayingOut(true); setAiError(''); setMessage('');
    try {
      const concepts = types.map(t => ({ name: t.name, definition: (t.description || '').slice(0, 80) }));
      const rels = relations.map(r => `${r.from} -${r.name}-> ${r.to}`);
      const response = await aiApi.proxy([
        { role: 'system', content: '你是研究框架图布局助手。根据概念与关系，给出分行排版方案。规则：1) 按研究逻辑分行（如驱动、行动、结果等阶段），2-6 行；2) 每个概念必须且只能出现一行，用原始全名；3) 关系密集的概念放入相邻行；4) orientation: LR=行从左到右流动（适合因果/流程链），TB=从上到下。只返回 JSON: {"orientation":"LR","rows":[{"title":"行标题","items":["概念全名"]}]}' },
        { role: 'user', content: JSON.stringify({ concepts, relations: rels }) },
      ]);
      const raw = response?.choices?.[0]?.message?.content || '';
      const plan = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
      const names = new Set(types.map(t => t.name));
      const seen = new Set();
      const rows = (Array.isArray(plan.rows) ? plan.rows : [])
        .map(r => ({ title: r.title || '', items: (Array.isArray(r.items) ? r.items : []).filter(n => names.has(n) && !seen.has(n) && (seen.add(n), true)) }))
        .filter(r => r.items.length);
      const missing = types.map(t => t.name).filter(n => !seen.has(n));
      if (missing.length) rows.push({ title: '', items: missing });
      if (!rows.length) throw new Error('AI 未返回有效分行');
      setLayoutPlan({ orientation: plan.orientation === 'TB' ? 'TB' : 'LR', rows });
      setMessage('AI 排布已应用。可在图中拖动微调后「保存布局」固定。');
    } catch (e) {
      setAiError('AI 排布失败：' + e.message);
    } finally {
      setAiLayingOut(false);
    }
  }

  // AI 起草：基于概念定义与案例证据提出修订建议，人工采纳后才写入
  async function aiDraft() {
    setAiBusy(true); setAiError(''); setAiProposals(null); setMessage('');
    try {
      const evidence = instances.slice(0, 10).map(({ c, e }) => `${e.name}（案例：${c.name}）`);
      const response = await aiApi.proxy([
        { role: 'system', content: '你是研究框架修订助手。基于概念定义与案例证据提出框架修订建议。只返回 JSON: {"proposals":[{"kind":"refine_definition","target":"概念名","definition":"修订后的完整定义","reason":"依据"}]}。最多 3 条；证据不足时返回空数组；不得编造证据中不存在的内容。' },
        { role: 'user', content: JSON.stringify({ concept: active?.name, definition: active?.description || '', evidence }) },
      ]);
      const raw = response?.choices?.[0]?.message?.content || '';
      const parsed = JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
      setAiProposals(Array.isArray(parsed.proposals) ? parsed.proposals : []);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiBusy(false);
    }
  }

  async function acceptProposal(p) {
    const target = types.find(t => t.name === (p.target || active?.name)) || active;
    await useSchemaStore.getState().updateEntityType(schema.id, target.id, { description: p.definition });
    setAiProposals(list => list.filter(x => x !== p));
    setMessage(`建议已采纳并写入「${target.name}」的定义。`);
  }

  return <div className="academic-framework fw2">
    <div className="fw-statusbar">
      <span className="fw-status-main">研究框架</span>
      <select className="fw-schema-select" value={schema?.id || ''} onChange={(e) => switchSchema(e.target.value)} title="切换研究框架">
        {(schemas || []).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
      </select>
      <span className={`fw-status-ver ${verInfo?.status || 'none'}`}>{verInfo ? `${verInfo.key} · ${VER_STATUS_LABEL[verInfo.status] || verInfo.status}` : '未纳入版本管理'}</span>
      {verInfo?.status === 'draft' && <span className="fw-draft-hint">草案修订中，批准后生效</span>}
      {message && <span className="fw-message" role="status">{message}</span>}
    </div>

    <div className="fw2-body">
      <div className="fw2-main">
        <section className="fw2-graph" aria-label="框架实体关系图">
          <div className="fw2-toolbar">
            <button className="fw2-tool fw2-tool-primary" onClick={addConcept} title="新增实体概念，画布中点击节点查看与修订">＋ 实体</button>
            <button className="fw2-tool fw2-tool-primary" onClick={startAddRelation} disabled={!types.length} title="新建关系，也可在画布中从一个节点拖线到另一节点">＋ 关系</button>
            <span className="fw2-toolbar-note">点击实体或连线出现下方面板 · 画布拖线直接建关系</span>
            <span className="fw2-flex" />
            <button className="fw2-tool" onClick={() => setTidySignal(s => s + 1)} title="按关系结构自动重排节点">自动整理</button>
            <button className="fw2-tool" onClick={aiLayout} disabled={aiLayingOut} title="让 AI 按研究逻辑分行排布">{aiLayingOut ? 'AI 排布中…' : 'AI 排布'}</button>
          </div>
          <div className="fw-graph-canvas fw2-canvas">
            {schema && <SchemaVisualization
              schema={schema}
              tidySignal={tidySignal}
              layoutPlan={layoutPlan}
              onConnect={handleGraphConnect}
              onEdgeDelete={handleGraphEdgeDelete}
              onNodeDelete={deleteConceptById}
        onNodeClick={(node) => { const t = types.find(x => String(x.id) === String(node.id)); if (t) selectType(t); }}
              onEdgeClick={(edge) => { const r = relations.find(x => String(x.id) === String(edge.id)); if (r) { setRevising(false); setType(types.find(t => t.name === r.from) || null); setRelEditing({ ...r }); setAiProposals(null); setAiError(''); setMessage(''); } }}
            />}
          </div>
        </section>
        <section className="fw2-panel" aria-label="框架详情面板">
          {relEditing ? <div className="fw-relpanel">
            <div className="fw-relpanel-head"><b>{relEditing.__new ? '新建关系' : `关系 · ${relEditing.from} → ${relEditing.to}`}</b><button onClick={() => setRelEditing(null)} title="关闭">×</button></div>
            <label>关系名<input value={relEditing.name || ''} onChange={e => setRelEditing({ ...relEditing, name: e.target.value })} /></label>
            <div className="fw-relpanel-ends">
              <label>起点<select value={relEditing.from || ''} onChange={e => setRelEditing({ ...relEditing, from: e.target.value })}>{types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select></label>
              <label>终点<select value={relEditing.to || ''} onChange={e => setRelEditing({ ...relEditing, to: e.target.value })}>{types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select></label>
            </div>
            <label>说明（可选）<textarea rows={2} value={relEditing.description || ''} onChange={e => setRelEditing({ ...relEditing, description: e.target.value })} /></label>
            <div className="fw-relpanel-actions">
              <button onClick={async () => {
                if (relEditing.__new) {
                  if (!relEditing.name.trim() || !relEditing.from || !relEditing.to) return setMessage('关系名、起点与终点概念均需填写。');
                  await useSchemaStore.getState().addRelation(schema.id, { name: relEditing.name.trim(), from: relEditing.from, to: relEditing.to, description: relEditing.description });
                  setRelEditing(null);
                  setMessage('关系已添加。');
                  return;
                }
                await useSchemaStore.getState().updateRelation(schema.id, relEditing.id, { name: relEditing.name, from: relEditing.from, to: relEditing.to, description: relEditing.description });
                setRelEditing(null);
                setMessage('关系已更新。');
              }}>保存</button>
              <button onClick={() => setRelEditing(null)}>取消</button>
              {!relEditing.__new && <button className="fw-danger" onClick={async () => { if (!window.confirm('删除该关系？')) return; await useSchemaStore.getState().deleteRelation(schema.id, relEditing.id); setRelEditing(null); setMessage('关系已删除。'); }}>删除</button>}
            </div>
          </div>
          : active ? (revising ? <div className="fw-edit">
            <h3>修订 · {active.name}</h3>
            <label>概念名称<input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
            <label>定义与识别依据<textarea rows={4} value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
            <div className="fw-edit-actions"><button onClick={saveEdit}>保存修订</button><button onClick={() => { setRevising(false); setMessage(''); }}>取消</button><button className="fw-danger" onClick={removeConcept}>删除此概念</button></div>
            <div className="fw-rel">
              <h4>相关关系 · {relatedRelations.length}</h4>
              {relatedRelations.map(r => <div className="fw-rel-row" key={r.id}><span>{r.from} —{r.name}→ {r.to}</span><button onClick={() => removeRelation(r)}>删除</button></div>)}
              {!relatedRelations.length && <p className="academic-muted">尚无涉及此概念的关系。</p>}
              <div className="fw-rel-add">
                <input placeholder="关系名（如 影响）" value={relDraft.name} onChange={e => setRelDraft({ ...relDraft, name: e.target.value })} />
                <select value={relDraft.from} onChange={e => setRelDraft({ ...relDraft, from: e.target.value })}><option value="">起点概念</option>{types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
                <select value={relDraft.to} onChange={e => setRelDraft({ ...relDraft, to: e.target.value })}><option value="">终点概念</option>{types.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}</select>
                <button onClick={addRelation}>新增关系</button>
              </div>
            </div>
            <div className="fw-advanced">
              <button onClick={() => setAdvanced(v => !v)}>{advanced ? '收起完整结构编辑器' : '完整结构编辑器（高级：画布/属性/关系细节）'}</button>
              {advanced && <SchemaArchitect {...props} />}
            </div>
          </div> : <>
            <h3>{active.name}</h3>
            <h4>定义与识别依据</h4>
            <p className="fw-def">{active.description || '尚未填写定义。点击「修订框架」补充识别依据。'}</p>
            <details className="fw-evidence">
              <summary>证据 · {instances.length} 条（来自案例实体归类）</summary>
              {!instances.length && <p className="academic-muted">尚无案例归入此概念；这不代表现象未发生，只是尚未登记。</p>}
              {instances.slice(0, 10).map(({ c, e }) => <button className="research-record" key={`${c.id}:${e.id}`} onClick={() => useWorkspaceStore.getState().openCaseDetail(c.id)}>{e.name} · {c.name}</button>)}
              {instances.length > 10 && <p className="academic-muted">仅显示前 10 条，全部实例请在案例集或图谱中查看。</p>}
            </details>
            <div className="fw-revise">
              <button onClick={startRevise}>修订框架</button>
              <button onClick={aiDraft} disabled={aiBusy}>{aiBusy ? 'AI 起草中…' : 'AI 起草修订'}</button>
              {aiError && <span role="alert" className="fw-error">{aiError}</span>}
            </div>
            {aiProposals && <div className="fw-proposals">
              <h4>AI 修订建议（采纳后才写入框架）</h4>
              {!aiProposals.length && <p className="academic-muted">证据不足，AI 未提出修订建议。</p>}
              {aiProposals.map((p, i) => <section key={i}>
                <b>{p.target || active?.name}</b>
                <p>{p.definition}</p>
                <p className="academic-muted">依据：{p.reason}</p>
                <button onClick={() => acceptProposal(p)}>采纳</button>
              </section>)}
            </div>}
          </>) : <div className="fw-overview">
            <h3>{schema?.name || '选择研究框架'}</h3>
            <p className="fw-def">{schema?.description || '框架指导阅读，案例证据推动修订，研究者决定解释和分类。'}</p>
            <div className="fw-stats">
              <span className="fw-stat-chip">概念 · {types.length}</span>
              <span className="fw-stat-chip">关系 · {relations.length}</span>
              <span className="fw-stat-chip">关联案例 · {matching.length}</span>
            </div>
            <p className="academic-muted">点击图中的实体或连线查看与编辑；「＋ 实体」「＋ 关系」在图上方，画布中拖线可直接建关系。</p>
          </div>}
        </section>
      </div>
      <aside className="fw2-timeline" aria-label="schema 版本时间线">
        <header className="fw2-tl-head"><strong>schema 更改历史</strong></header>
        {versions.length ? <ol className="fw2-tl">
          {versions.map(v => (
            <li key={v.id} className={verInfo?.key === v.version_key ? 'current' : ''}>
              <span className="fw2-tl-dot" />
              <div className="fw2-tl-body">
                <b>{v.version_key}</b>
                <small>{VER_STATUS_LABEL[v.status] || v.status}{v.created_at ? ` · ${new Date(v.created_at).toLocaleDateString()}` : ''}</small>
              </div>
            </li>
          ))}
        </ol> : <p className="fw2-tl-empty">{schema ? '该框架尚未纳入版本管理。' : '选择研究框架后查看更改历史。'}</p>}
        <p className="fw2-tl-hint">记录框架的每次版本演进，当前生效版本高亮。</p>
      </aside>
    </div>
  </div>;
}
