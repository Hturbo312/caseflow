import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../../../i18n';
import { useCaseResearch } from './ResearchAgent';
const labels = { pending: 'tl.st.pending', confirmed: 'tl.st.confirmed', rejected: 'tl.st.rejected' };

export default function ThreeLayerCase() {
  const { t } = useI18n();
  const r = useCaseResearch();
  const [version, setVersion] = useState('');
  const [error, setError] = useState('');
  const sourceRef = useRef(null);
  const data = r.record?.data;
  const draft = data?.drafts.find(d => d.id === version) || data?.drafts.at(-1);
  const citation = r.selected?.citation;
  const source = data?.sources.find(s => s.id === citation?.sourceId) || data?.sources[0];
  useEffect(() => { sourceRef.current?.querySelector('mark')?.scrollIntoView({ block: 'center', behavior: 'auto' }); }, [r.selected]);
  async function review(action, payload) {
    r.setBusy(r.key, t('tl.saving')); setError('');
    try { await r.act(r.key, r.id, action, payload); } catch (e) { setError(e.message); }
    finally { r.setBusy(r.key, ''); }
  }
  const locate = (p, c) => { r.select(r.key, { paragraphId: p.id, citation: c }); };
  return <section className="three-layer">
    <header><h3>{t('tl.title')}</h3><small>{t('tl.note')}</small></header>
    {(error || r.error) && <p role="alert">{error || r.error}<button onClick={() => r.load(r.key, r.id)}>{t('tl.reload')}</button></p>}
    {!data ? <p>{t('tl.loading')}</p> : <>
      <div className="three-layer-reading">
        <section className="draft-pane"><h4>{t('tl.draft')}</h4>
          {!draft ? <p>{t('tl.draftEmpty')}</p> : <>
            <label>{t('tl.version')}<select value={draft.id} onChange={e => { setVersion(e.target.value); r.select(r.key, null); }}>{data.drafts.map((d,i) => <option key={d.id} value={d.id}>{t('tl.draftN', { n: i+1 })} · {t(labels[d.status])}</option>)}</select></label>
            <p>{t('tl.draftNote')}</p>
            {draft.paragraphs.map((p,i) => <article key={p.id} id={`draft-${p.id}`} className={r.selected?.paragraphId === p.id ? 'selected' : ''}>
              <small>{t('tl.para')} {i+1} · {p.kind === 'conflict' ? t('tl.kind.conflict') : p.kind === 'gap' ? t('tl.kind.gap') : t('tl.kind.summary')}</small><p>{p.text}</p>
              {p.citations.map((c,j) => <button key={j} onClick={() => locate(p,c)}>↗ {data.sources.find(s => s.id === c.sourceId)?.title || t('tl.cite')} · {t('tl.citeN')} {j+1}</button>)}
            </article>)}
            <div className="research-actions"><button disabled={!!r.working || draft.status === 'confirmed'} onClick={() => review('reviewDraft', { id: draft.id, status: 'confirmed' })}>{t('tl.confirmDraft')}</button><button disabled={!!r.working || draft.status === 'rejected'} onClick={() => review('reviewDraft', { id: draft.id, status: 'rejected' })}>{t('tl.rejectDraft')}</button></div>
          </>}
        </section>
        <section className="raw-pane"><h4>{t('tl.sources', { n: data.sources.length })}</h4>
          {source ? <><label>{t('tl.pickSource')}<select value={source.id} onChange={e => r.select(r.key, { citation: { sourceId: e.target.value } })}>{data.sources.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
            <small>{source.author || t('tl.noAuthor')} · {source.date || t('tl.noDate')}</small><p className="source-uri">{source.uri}</p>
            <div ref={sourceRef} className="raw-text">{citation?.quote && citation.sourceId === source.id ? <>{source.text.slice(0,citation.start)}<mark>{source.text.slice(citation.start,citation.start+citation.quote.length)}</mark>{source.text.slice(citation.start+citation.quote.length)}</> : source.text}</div>
          </> : <p>{t('tl.noSource')}</p>}
        </section>
      </div>
      <section className="knowledge-pane"><h4>{t('tl.candidates')}</h4><small>{t('tl.candidatesNote')}</small>
        {data.extractions.filter(e => e.draftId === draft?.id).length === 0 && <p>{t('tl.extractEmpty')}</p>}
        {data.extractions.filter(e => e.draftId === draft?.id).map((ex,n) => <details open key={ex.id}><summary>{t('tl.batch', { n: n+1, m: ex.items.length })}</summary>{ex.items.map(item => <article key={item.id}><strong>{item.name}</strong><small>{item.type} · {labels[item.status] ? t(labels[item.status]) : item.status}</small>
          <div className="research-actions">{item.paragraphIds.map(pid => <button key={pid} onClick={() => { const p = draft.paragraphs.find(p => p.id === pid); locate(p,p.citations[0]); document.getElementById(`draft-${pid}`)?.scrollIntoView({ block: 'nearest' }); }}>{t('tl.locate', { n: draft.paragraphs.findIndex(p => p.id === pid)+1 })}</button>)}
            <button disabled={!!r.working || item.status === 'confirmed'} onClick={() => review('reviewItem', { id: item.id, status: 'confirmed' })}>{t('tl.confirm')}</button><button disabled={!!r.working || item.status === 'rejected'} onClick={() => review('reviewItem', { id: item.id, status: 'rejected' })}>{t('tl.reject')}</button>
          </div></article>)}</details>)}
      </section>
    </>}
  </section>;
}
