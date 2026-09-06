import { useEffect, useRef, useState } from 'react';
import { useCaseResearch } from './ResearchAgent';
const labels = { pending: '待核查', confirmed: '已确认', rejected: '已驳回' };

export default function ThreeLayerCase() {
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
    r.setBusy(r.key, '正在保存审核…'); setError('');
    try { await r.act(r.key, r.id, action, payload); } catch (e) { setError(e.message); }
    finally { r.setBusy(r.key, ''); }
  }
  const locate = (p, c) => { r.select(r.key, { paragraphId: p.id, citation: c }); };
  return <section className="three-layer">
    <header><h3>来源 → 整理稿 → 候选知识</h3><small>原始文本保留不覆盖 · 引用可追溯 · 当前账户私有研究记录</small></header>
    {(error || r.error) && <p role="alert">{error || r.error}<button onClick={() => r.load(r.key, r.id)}>重新加载</button></p>}
    {!data ? <p>正在加载材料…</p> : <>
      <div className="three-layer-reading">
        <section className="draft-pane"><h4>整理稿</h4>
          {!draft ? <p>从工作区“导入材料”唤起左侧 Agent，登记多份材料后生成整理稿。</p> : <>
            <label>整理版本<select value={draft.id} onChange={e => { setVersion(e.target.value); r.select(r.key, null); }}>{data.drafts.map((d,i) => <option key={d.id} value={d.id}>第 {i+1} 稿 · {labels[d.status]}</option>)}</select></label>
            <p>精确引用已校验；这不代表 AI 概括已被证实。</p>
            {draft.paragraphs.map((p,i) => <article key={p.id} id={`draft-${p.id}`} className={r.selected?.paragraphId === p.id ? 'selected' : ''}>
              <small>段落 {i+1} · {p.kind === 'conflict' ? '来源冲突' : p.kind === 'gap' ? '证据缺口' : '材料概括'}</small><p>{p.text}</p>
              {p.citations.map((c,j) => <button key={j} onClick={() => locate(p,c)}>↗ {data.sources.find(s => s.id === c.sourceId)?.title || '来源'} · 引用 {j+1}</button>)}
            </article>)}
            <div className="research-actions"><button disabled={!!r.working || draft.status === 'confirmed'} onClick={() => review('reviewDraft', { id: draft.id, status: 'confirmed' })}>确认这版整理稿</button><button disabled={!!r.working || draft.status === 'rejected'} onClick={() => review('reviewDraft', { id: draft.id, status: 'rejected' })}>驳回，重新整理</button></div>
          </>}
        </section>
        <section className="raw-pane"><h4>来源材料 · {data.sources.length} 份</h4>
          {source ? <><label>选择来源<select value={source.id} onChange={e => r.select(r.key, { citation: { sourceId: e.target.value } })}>{data.sources.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
            <small>{source.author || '作者未登记'} · {source.date || '日期未登记'}</small><p className="source-uri">{source.uri}</p>
            <div ref={sourceRef} className="raw-text">{citation?.quote && citation.sourceId === source.id ? <>{source.text.slice(0,citation.start)}<mark>{source.text.slice(citation.start,citation.start+citation.quote.length)}</mark>{source.text.slice(citation.start+citation.quote.length)}</> : source.text}</div>
          </> : <p>尚未登记来源。已有旧材料仍在下方保留。</p>}
        </section>
      </div>
      <section className="knowledge-pane"><h4>候选知识 · 对应所选整理版本</h4><small>这里的确认仅记录研究审核；尚不发布到正式图谱。</small>
        {data.extractions.filter(e => e.draftId === draft?.id).length === 0 && <p>确认整理稿后，在左侧 Agent 发起抽取。</p>}
        {data.extractions.filter(e => e.draftId === draft?.id).map((ex,n) => <details open key={ex.id}><summary>抽取批次 {n+1} · {ex.items.length} 项</summary>{ex.items.map(item => <article key={item.id}><strong>{item.name}</strong><small>{item.type} · {labels[item.status]}</small>
          <div className="research-actions">{item.paragraphIds.map(pid => <button key={pid} onClick={() => { const p = draft.paragraphs.find(p => p.id === pid); locate(p,p.citations[0]); document.getElementById(`draft-${pid}`)?.scrollIntoView({ block: 'nearest' }); }}>定位整理段落 {draft.paragraphs.findIndex(p => p.id === pid)+1}</button>)}
            <button disabled={!!r.working || item.status === 'confirmed'} onClick={() => review('reviewItem', { id: item.id, status: 'confirmed' })}>确认</button><button disabled={!!r.working || item.status === 'rejected'} onClick={() => review('reviewItem', { id: item.id, status: 'rejected' })}>驳回</button>
          </div></article>)}</details>)}
      </section>
    </>}
  </section>;
}
