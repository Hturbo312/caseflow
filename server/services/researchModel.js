import { randomUUID, createHash } from 'node:crypto';

export const SECTIONS = ['背景与问题', '参与主体', '更新行动与过程', '技术与能力', '结果与影响', '冲突与证据缺口'];
export const digest = value => createHash('sha256').update(value).digest('hex');
export function sourcePieces(source, limit = 8000) {
  const pieces = [];
  const blocks = source.blocks?.length ? source.blocks : [{ id: 'text', text: source.text || '', start: 0 }];
  for (const block of blocks) {
    for (let offset = 0; offset < block.text.length; offset += limit) {
      pieces.push({ sourceId: source.id, blockId: block.id, page: block.page, start: (block.start || 0) + offset, text: block.text.slice(offset, offset + limit) });
    }
  }
  return pieces;
}
export function validateCitations(citations, sources) {
  if (!Array.isArray(citations) || !citations.length || citations.length > 40) throw new Error('每个事实片段必须包含有效原文引用');
  return citations.map(c => {
    const source = sources.find(s => s.id === c.sourceId);
    if (!source || typeof c.quote !== 'string' || !c.quote.trim() || c.quote.length > 12000) throw new Error('引用材料或摘录无效');
    const block = c.blockId ? source.blocks?.find(b => b.id === c.blockId) : null;
    if (c.blockId && !block) throw new Error('引用段落不存在');
    const haystack = block?.text ?? source.text;
    let local = Number.isInteger(c.start) ? c.start - (block?.start || 0) : -1;
    if (local < 0 || haystack.slice(local, local + c.quote.length) !== c.quote) {
      local = haystack.indexOf(c.quote);
      if (local < 0) throw new Error('引用未匹配原文，未保存本次生成结果');
      if (haystack.indexOf(c.quote, local + 1) >= 0) throw new Error('原文存在重复摘录，需要明确段落或位置');
    }
    const start = (block?.start || 0) + local;
    const located = block || source.blocks?.find(b => start >= b.start && start + c.quote.length <= b.start + b.text.length);
    return { sourceId: source.id, quote: c.quote, start, end: start + c.quote.length, blockId: located?.id, page: located?.page };
  });
}
export function normalizeParagraph(p, sources, existingId) {
  if (typeof p.text !== 'string' || !p.text.trim() || p.text.length > 12000) throw new Error('总结片段正文无效');
  const citations = validateCitations(p.citations, sources);
  const units = (Array.isArray(p.units) ? p.units : []).slice(0, 30).map(u => {
    if (!u.subject?.trim() || !u.predicate?.trim() || !u.object?.trim()) throw new Error('关系单元缺少主体、关系或作用对象');
    return { id: randomUUID(), subject: String(u.subject).slice(0, 300), subjectType: String(u.subjectType || '主体').slice(0, 100), predicate: String(u.predicate).slice(0, 200), object: String(u.object).slice(0, 300), objectType: String(u.objectType || '作用对象').slice(0, 100), time: String(u.time || '').slice(0, 100), context: String(u.context || '').slice(0, 500), status: 'pending', citations: u.citations?.length ? validateCitations(u.citations, sources) : citations };
  });
  return { id: existingId || randomUUID(), text: p.text.trim(), section: SECTIONS.includes(p.section) ? p.section : '更新行动与过程', kind: ['fact', 'conflict', 'gap'].includes(p.kind) ? p.kind : 'fact', eventTime: String(p.eventTime || ''), citations, units };
}
export function applyParagraphs(existing, incoming, sources, allowedIds = []) {
  const paragraphs = structuredClone(existing);
  for (const p of incoming) {
    const index = p.id && allowedIds.includes(p.id) ? paragraphs.findIndex(old => old.id === p.id && !old.locked) : -1;
    const next = normalizeParagraph(p, sources, index >= 0 ? p.id : undefined);
    if (index >= 0) {
      // An incremental rewrite must not silently discard earlier evidence.
      const old = paragraphs[index];
      const covered = old.citations.every(c => next.citations.some(n => n.sourceId === c.sourceId && n.quote === c.quote));
      if (!covered) throw new Error('更新遗漏了既有证据，已保留上一版总结稿');
      paragraphs[index] = next;
    } else if (!paragraphs.some(old => old.text === next.text && JSON.stringify(old.citations) === JSON.stringify(next.citations))) paragraphs.push(next);
  }
  return paragraphs.sort((a, b) => (SECTIONS.indexOf(a.section) - SECTIONS.indexOf(b.section)) || (a.eventTime && b.eventTime ? a.eventTime.localeCompare(b.eventTime) : 0));
}
