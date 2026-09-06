import { useState } from 'react';
import { useCaseStore, useSchemaStore, useAuthStore } from '../../../../store';
import { useWorkspaceStore } from '../../../../store/workspaceStore';
import SchemaWorkspace from './SchemaWorkspace';

export function ResearchLens({ caseItem }) {
  const schema = useSchemaStore(s => s.schemas.find(x => String(x.id) === String(caseItem.schemaId || caseItem.schema_id)));
  const [selected, setSelected] = useState(null);
  return <div className="academic-lens"><strong>研究视角</strong><span>用于理解材料，允许暂不归类</span>
    <div>{(schema?.entityTypes || []).map(type => <button key={type.id} aria-pressed={selected?.id === type.id} onClick={() => setSelected(selected?.id === type.id ? null : type)}>{type.name}</button>)}</div>
    {selected && <section><b>{selected.name}</b><p>{selected.description || '尚未填写定义，可在研究框架中补充识别依据。'}</p><p>本案例对应记录：{(caseItem.entities || []).filter(e => (e.entityType || e.entity_type) === selected.name).map(e => e.name).join('、') || '暂未关联，不代表该现象未发生'}</p><button onClick={() => useWorkspaceStore.getState().setMainTab('schema')}>查看完整研究框架</button></section>}
  </div>;
}

export default function FrameworkGuide(props) {
  const { schemas, currentSchemaId } = useSchemaStore();
  const cases = useCaseStore(s => s.cases);
  const userId = useAuthStore(s => s.user?.id || 'guest');
  const schema = schemas.find(s => String(s.id) === String(currentSchemaId));
  return <GuideSession key={`${userId}:${currentSchemaId}`} {...props} schema={schema} cases={cases} storageKey={`cf-framework-notes:${userId}:${currentSchemaId}`} />;
}

function GuideSession({ schema, cases, storageKey, ...props }) {
  const [type, setType] = useState(null);
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(() => { try { return JSON.parse(localStorage.getItem(storageKey)) || []; } catch { return []; } });
  const [draft, setDraft] = useState({ caseId: '', quote: '', question: '' });
  const [message, setMessage] = useState('');
  const types = schema?.entityTypes || [];
  const active = type || types[0];
  const matching = cases.filter(c => String(c.schemaId || c.schema_id) === String(schema?.id));
  const instances = matching.flatMap(c => (c.entities || []).filter(e => (e.entityType || e.entity_type) === active?.name).map(e => ({ c, e })));
  function save() {
    const next = [...notes, { ...draft, concept: active?.name || '', createdAt: new Date().toISOString() }];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setNotes(next); setDraft({ caseId: '', quote: '', question: '' }); setMessage('已保存到本机待讨论记录；尚未形成框架修改或服务器审核任务。'); } catch { setMessage('保存失败，请复制保留你的记录。'); }
  }
  return <div className="academic-framework"><small>研究手册 / 框架与证据</small><h2>{schema?.name || '选择研究框架'}</h2><p>{schema?.description || '框架指导阅读，案例证据推动修订，研究者决定解释和分类。'}</p>
    <div className="research-actions"><button aria-pressed={!editing} onClick={() => setEditing(false)}>定义与案例实例</button><button aria-pressed={editing} onClick={() => setEditing(true)}>编辑结构与版本</button></div>
    {editing ? <SchemaWorkspace {...props} /> : <div className="academic-framework-grid"><nav aria-label="框架概念">{types.map(t => <button key={t.id} aria-pressed={t.id === active?.id} onClick={() => setType(t)}>{t.name}</button>)}{!types.length && <p>尚无概念定义。</p>}</nav><article>
      <h3>{active?.name || '研究概念'}</h3><h4>定义与识别依据</h4><p>{active?.description || '当前框架尚未记录此概念的定义。可在结构编辑中补充。'}</p>
      <h4>已关联实例 · {instances.length}</h4><p className="academic-muted">关联记录用于理解概念，不自动视为已核实的支持证据。</p>{instances.slice(0, 30).map(({ c, e }) => <button className="research-record" key={`${c.id}:${e.id}`} onClick={() => useWorkspaceStore.getState().openCaseDetail(c.id)}>{e.name} · {c.name}</button>)}{instances.length > 30 && <p>展示前 30 条，更多实例请在案例集中查看。</p>}
      <h4>现有分类不合适？</h4><p>先保留材料和疑问，再决定是否修订框架。</p><label>关联案例<select value={draft.caseId} onChange={e => setDraft({ ...draft, caseId: e.target.value })}><option value="">暂不关联案例</option>{matching.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>材料摘录<textarea value={draft.quote} onChange={e => setDraft({ ...draft, quote: e.target.value })} /></label><label>疑问与初步想法<textarea value={draft.question} onChange={e => setDraft({ ...draft, question: e.target.value })} /></label><button disabled={!draft.question.trim()} onClick={save}>保留为待讨论问题</button><p role="status">{message}</p>
      <details><summary>待讨论问题 · {notes.length}（本机）</summary>{notes.map((n, i) => <section key={i}><b>{n.concept || '未归类'}</b><blockquote>{n.quote}</blockquote><p>{n.question}</p><small>{n.caseId ? `关联案例 ${n.caseId} · ` : ''}{n.createdAt.slice(0, 10)}</small></section>)}</details>
    </article></div>}
  </div>;
}
