import { useState, useEffect } from 'react';
import { useI18n } from '../../../../i18n';
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
  const { t } = useI18n();
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
    try { localStorage.setItem(key, JSON.stringify(next)); setDraft(next); setMessage(t('ra.saved')); } catch { setMessage(t('ra.saveFail')); }
  };
  const cite = ev => {
    const citation = { ...ev, caseId: active.caseId, itemId: active.item.id, type: active.type };
    setDraft(d => ({ ...d, citations: [...d.citations.filter(c => c.id !== ev.id), citation] }));
    setMessage(t('ra.citeAdded'));
  };
  const exportFinding = () => {
    const text = `# ${draft.question || t('ra.exp.finding')}\n\n${t('ra.exp.scope')}：${selected.map(c => c.name).join('、')}\n${t('ra.exp.frame')}：${schemaId}\n\n${draft.finding}\n\n## ${t('ra.exp.limits')}\n${draft.limits}\n\n## ${t('ra.exp.cites')}\n${draft.citations.map((c, i) => `${i + 1}. ${t('ra.exp.scope')} ${c.caseId}，${c.document_title || t('ra.exp.unnamed')}，${t('tl.para')} ${c.segment_id || '-'}，${t('ra.exp.cites')} ${c.id}\n> ${c.quote || ''}`).join('\n\n')}`;
    downloadBlob(new Blob([text], { type: 'text/markdown;charset=utf-8' }), t('ra.exp.file'));
  };
  return <div className="research-analysis">
    <h2>{t('ra.title')}</h2><p>{t('ra.hint')}</p>
    <label>{t('ra.question')}<input value={draft.question} onChange={e => update('question', e.target.value)} placeholder={t('ra.questionPh')} /></label>
    <details><summary>{t('ra.pick', { n: ids.length, max: MAX })}</summary>{cases.map(c => <label key={c.id}><input type="checkbox" checked={ids.includes(String(c.id))} disabled={!ids.includes(String(c.id)) && ids.length >= MAX} onChange={() => toggle(c.id)} /> {c.name}</label>)}</details>
    <div className="research-actions">{selected.map(c => <button key={c.id} onClick={() => remove(c.id)}>{c.name} ×</button>)}</div>
    {ids.length < 2 && <p>{t('ra.min')}</p>}
    {draft.caseIds?.length > 0 && draft.caseIds.join(',') !== ids.join(',') && <p role="status">{t('ra.drift')}</p>}
    <div className="research-comparison">{selected.map(c => <section key={c.id}><h3>{c.name}</h3><p>{c.description || t('ra.noDraft')}</p><button disabled={!isAuthenticated} onClick={() => setPreview({ caseId: c.id, evidence: null })}>{t('ra.readSource')}</button>
      <details><summary>{t('ra.pickEntities', { n: c.entities?.length || 0 })}</summary>{c.entities?.map(e => <button className="research-record" key={e.id} onClick={() => { setActive({ item: e, type: 'entity', caseId: c.id }); setPreview(null); }}>{e.name}</button>)}</details>
      <details><summary>{t('ra.pickRelations', { n: c.relations?.length || 0 })}</summary>{c.relations?.map(r => <button className="research-record" key={r.id} onClick={() => { setActive({ item: r, type: 'relation', caseId: c.id }); setPreview(null); }}>{r.relationType || r.relation_type} · {r.sourceId} → {r.targetId}</button>)}</details>
    </section>)}</div>
    {active && isAuthenticated && <EvidenceInspector key={`${active.type}:${active.item.id}`} {...active} onLocate={ev => setPreview({ caseId: active.caseId, evidence: ev })} onCite={cite} />}
    {preview && <div className="research-preview"><button onClick={() => setPreview(null)}>{t('ra.closePreview')}</button><SourceReader key={preview.caseId} caseId={preview.caseId} evidence={preview.evidence} positionKey={`analysis:${preview.caseId}`} /></div>}
    <label>{t('ra.finding')}<textarea value={draft.finding} onChange={e => update('finding', e.target.value)} placeholder={t('ra.findingPh')} /></label>
    <label>{t('ra.limits')}<textarea value={draft.limits} onChange={e => update('limits', e.target.value)} /></label>
    <p>{t('ra.cited', { n: draft.citations.length })}</p>
    {draft.citations.map(c => <div key={c.id}><button onClick={() => setPreview({ caseId: c.caseId, evidence: c })}>{c.document_title || t('rc.source.doc')} · {c.quote?.slice(0, 50)}</button><button onClick={() => update('citations', draft.citations.filter(x => x.id !== c.id))}>{t('ra.removeCite')}</button></div>)}
    <div className="research-actions"><button onClick={save}>{t('ra.save')}</button><button onClick={exportFinding}>{t('ra.export')}</button></div><p role="status">{message}</p>
    <details className="research-tools" onToggle={e => setTools(e.currentTarget.open)}><summary>{t('ra.tools')}</summary>{tools && ids.length >= 2 && isAuthenticated ? <AnalysisWorkspace /> : <p>{t('ra.toolsHint')}</p>}</details>
  </div>;
}
