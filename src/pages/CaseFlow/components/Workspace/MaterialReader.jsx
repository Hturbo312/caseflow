import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getDocument, GlobalWorkerOptions, Util } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { researchRequest, sourceBlob } from '../../../../services/researchWorkspace';

GlobalWorkerOptions.workerSrc = workerUrl;
function HighlightText({ text, quote }) {
  const i = quote ? text.indexOf(quote) : -1;
  return i < 0 ? text : <>{text.slice(0, i)}<mark>{text.slice(i, i + quote.length)}</mark>{text.slice(i + quote.length)}</>;
}
function PdfPage({ blob, pageNumber, citation, source, onPages }) {
  const canvas = useRef(null), container = useRef(null);
  const [width, setWidth] = useState(400), [marks, setMarks] = useState([]), [height, setHeight] = useState(600), [error, setError] = useState('');
  useEffect(() => { const observer = new ResizeObserver(([entry]) => setWidth(Math.max(160, entry.contentRect.width))); observer.observe(container.current); return () => observer.disconnect(); }, []);
  useEffect(() => {
    let live = true, document, render, task;
    (async () => {
      task = getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false });
      document = await task.promise;
      if (!live) { await document.destroy(); return; }
      setError(''); setMarks([]);
      onPages(document.numPages);
      const page = await document.getPage(Math.min(document.numPages, pageNumber));
      const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
      const content = await page.getTextContent();
      if (!live) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.current.width = viewport.width * dpr; canvas.current.height = viewport.height * dpr;
      setHeight(viewport.height);
      render = page.render({ canvasContext: canvas.current.getContext('2d'), viewport, transform: [dpr, 0, 0, dpr, 0, 0] });
      await render.promise;
      if (!live) return;
      const block = source.blocks?.find(b => b.page === pageNumber);
      const quote = citation?.page === pageNumber || (!citation?.page && block?.text.includes(citation?.quote)) ? citation?.quote : null;
      const items = content.items.filter(i => typeof i.str === 'string');
      const original = items.map(i => i.str + (i.hasEOL ? '\n' : ' ')).join('');
      const from = quote ? (Number.isInteger(citation.start) && block ? citation.start - block.start + original.length - original.trimStart().length : original.indexOf(quote)) : -1;
      let offset = 0;
      const rectangles = [];
      for (const item of items) {
        if (from >= 0 && offset < from + quote.length && offset + item.str.length > from) {
          const transform = Util.transform(viewport.transform, item.transform);
          const h = Math.hypot(transform[2], transform[3]);
          rectangles.push({ x: transform[4], y: transform[5] - h, w: Math.max(3, item.width * viewport.scale), h: h * 1.2 });
        }
        offset += item.str.length + 1;
      }
      setMarks(rectangles);
      if (rectangles.length) container.current.parentElement.scrollTop = Math.max(0, rectangles[0].y - 100);
    })().catch(e => { if (live && e.name !== 'RenderingCancelledException') setError('PDF 页面显示失败，请下载原件核对。'); });
    return () => { live = false; render?.cancel(); task?.destroy(); };
  }, [blob, pageNumber, citation, width, source, onPages]);
  return <div ref={container} className="crw-pdf-page" style={{ height }}>{error && <p role="alert">{error}</p>}<canvas ref={canvas} style={{ width, height }} />{marks.map((r, i) => <span className="crw-pdf-mark" key={i} style={{ left: r.x, top: r.y, width: r.w, height: r.h }} />)}</div>;
}
const allowedTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'strong', 'em', 'u', 's', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'br', 'blockquote', 'sup', 'sub', 'span']);
function safeDocx(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  for (const el of [...doc.body.querySelectorAll('*')]) {
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'IMG'].includes(el.tagName)) { el.remove(); continue; }
    if (!allowedTags.has(el.tagName.toLowerCase())) { el.replaceWith(...el.childNodes); continue; }
    for (const attr of [...el.attributes]) el.removeAttribute(attr.name);
  }
  return doc.body.innerHTML;
}
export default function MaterialReader({ caseId, sourceId, citation, onClose }) {
  const [source, setSource] = useState(null), [blob, setBlob] = useState(null), [html, setHtml] = useState('');
  const wordMarkup = useMemo(() => ({ __html: html }), [html]);
  const [error, setError] = useState(''), [page, setPage] = useState(citation?.page || 1), [pages, setPages] = useState(1), [retry, setRetry] = useState(0);
  const content = useRef(null), locationNotice = useRef(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const data = await researchRequest(caseId, `/materials/${sourceId}`);
      if (!live) return;
      setError('');
      setSource(data);
      if (data.html) setHtml(safeDocx(data.html));
      if (data.hasFile && (data.extension === '.pdf' || (data.extension === '.docx' && !data.html))) {
        const raw = await sourceBlob(caseId, sourceId);
        if (!live) return;
        setBlob(raw);
        if (data.extension === '.docx') {
          const mammoth = await import('mammoth');
          const output = await mammoth.convertToHtml({ arrayBuffer: await raw.arrayBuffer() });
          if (live) { setHtml(safeDocx(output.value)); if (!output.value) setError('Word 格式转换未生成内容，当前显示段落文本；可下载原件核验。'); }
        }
      }
    })().catch(e => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [caseId, sourceId, retry]);
  useEffect(() => {
    if (!content.current || !source || source.extension === '.pdf') return;
    // Wrap only matched text-node ranges, preserving Word/Markdown inline formatting.
    // Explicit marks also work in browsers without the CSS Highlights API.
    const marks = [];
    if (!citation?.quote) return;
    const scope = [...content.current.querySelectorAll('[data-source-block]')].find(el => el.dataset.sourceBlock === citation.blockId) || content.current;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
    let node, text = '', map = [];
    while ((node = walker.nextNode())) {
      for (let i = 0; i < node.textContent.length; i++) { if (!/\s/.test(node.textContent[i])) { text += node.textContent[i]; map.push([node, i]); } }
    }
    const needle = citation.quote.replace(/\s/g, '');
    let searchFrom = 0;
    if (html && citation.blockId) {
      // Align Word's rendered text with its parsed paragraph order, including repeated quotes.
      for (const block of source.blocks || []) {
        const blockText = block.text.replace(/\s/g, '');
        const found = text.indexOf(blockText, searchFrom);
        if (block.id === citation.blockId) { if (found >= 0) searchFrom = found; break; }
        if (found >= 0) searchFrom = found + blockText.length;
      }
    }
    const start = text.indexOf(needle, searchFrom);
    if (start >= 0 && needle.length) {
      const spans = new Map();
      for (const [textNode, offset] of map.slice(start, start + needle.length)) {
        const span = spans.get(textNode);
        if (span) span.end = offset + 1; else spans.set(textNode, { start: offset, end: offset + 1 });
      }
      for (const [textNode, span] of spans) {
        const range = document.createRange(); range.setStart(textNode, span.start); range.setEnd(textNode, span.end);
        const mark = document.createElement('mark'); range.surroundContents(mark); marks.push(mark);
      }
      marks[0]?.scrollIntoView({ block: 'center' });
      if (locationNotice.current) locationNotice.current.textContent = '已定位并高亮引用原文';
    } else {
      content.current.querySelector('mark,[data-located="true"]')?.scrollIntoView({ block: 'center' });
      if (locationNotice.current) locationNotice.current.textContent = '已显示引用摘录；格式差异使精确高亮不可用，请对照原段落核验。';
    }
    return () => { for (const mark of marks) mark.replaceWith(...mark.childNodes); };
  }, [source, html, citation]);
  async function download() {
    try { const raw = blob || await sourceBlob(caseId, sourceId); const url = URL.createObjectURL(raw); const a = document.createElement('a'); a.href = url; a.download = source.title; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); } catch (e) { setError(e.message); }
  }
  return <aside className="crw-reader" aria-label="原材料溯源">
    <header><strong>原材料</strong><button onClick={onClose} aria-label="关闭原材料">×</button></header>
    {error && <p role="alert">{error}<button onClick={() => setRetry(n => n + 1)}>重试</button></p>}
    {!source && !error && <p>正在读取材料…</p>}
    {source && <><div className="crw-reader-meta"><strong>{source.title}</strong><small>{citation?.page ? `第 ${citation.page} 页` : citation?.blockId ? `原文 ${citation.blockId.replace('paragraph-', '段落 ')}` : '原始材料'}{source.extension === '.docx' ? ' · Word 内容视图' : ''}</small>{source.hasFile && <button onClick={download}>下载原件</button>}</div>
      {citation?.quote && <details className="crw-quote" open><summary>本次引用摘录</summary><blockquote>{citation.quote}</blockquote></details>}
      {source.error && <p role="status">{source.error}</p>}
      {citation && source.extension !== '.pdf' && <small className="crw-location-notice" ref={locationNotice} role="status" />}
      {source.extension === '.pdf' && blob && <div className="crw-page-nav"><button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(p => p + 1)}>下一页</button></div>}
      <div className="crw-reader-content" ref={content}>
        {source.extension === '.pdf' && blob ? <PdfPage blob={blob} pageNumber={page} citation={citation} source={source} onPages={setPages} /> : html ? <div className="crw-word" dangerouslySetInnerHTML={wordMarkup} /> : (source.blocks?.length ? source.blocks : [{ id: 'text', text: source.text || '' }]).map(b => <div key={b.id} data-source-block={b.id} data-located={b.id === citation?.blockId} className="crw-source-block">{['.md', '.markdown'].includes(source.extension) ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{b.text}</ReactMarkdown> : <p><HighlightText text={b.text} quote={citation?.quote} /></p>}</div>)}
      </div>
    </>}
  </aside>;
}
