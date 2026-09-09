import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCitations, applyParagraphs, sourcePieces } from '../services/researchModel.js';

const sources = [{ id: 's1', text: '第一段证据。\n\n社区开展电话核查。', blocks: [{ id: 'p1', start: 0, text: '第一段证据。' }, { id: 'p2', start: 8, text: '社区开展电话核查。' }] }];
test('citation retains exact source and paragraph offsets', () => {
  const [citation] = validateCitations([{ sourceId: 's1', blockId: 'p2', quote: '电话核查' }], sources);
  assert.equal(citation.start, 12); assert.equal(citation.end, 16); assert.equal(citation.blockId, 'p2');
});
test('rejects invented, missing and ambiguous evidence', () => {
  for (const c of [{ sourceId: 'missing', quote: '电话核查' }, { sourceId: 's1', quote: '模型补写的事实' }, { sourceId: 's1', blockId: 'missing', quote: '电话核查' }]) assert.throws(() => validateCitations([c], sources));
  assert.throws(() => validateCitations([{ sourceId: 'repeat', quote: '相同' }], [{ id: 'repeat', text: '相同，相同' }]));
});
test('incremental revisions preserve IDs and earlier evidence, do not mutate old versions', () => {
  const first = applyParagraphs([], [{ text: '社区开展核查。', citations: [{ sourceId: 's1', blockId: 'p2', quote: '社区开展电话核查。' }], units: [{ subject: '社区', predicate: '开展', object: '电话核查' }] }], sources);
  const next = applyParagraphs(first, [{ ...first[0], text: '社区通过电话开展核查。' }], sources, [first[0].id]);
  assert.equal(next[0].id, first[0].id); assert.equal(first[0].text, '社区开展核查。');
  assert.throws(() => applyParagraphs(first, [{ ...first[0], citations: [{ sourceId: 's1', blockId: 'p1', quote: '第一段证据。' }] }], sources, [first[0].id]));
});
test('long material splitting retains every character and original offsets', () => {
  const text = '材料'.repeat(12000);
  const pieces = sourcePieces({ id: 'long', text, blocks: [{ id: 'p1', start: 0, text }] });
  assert.equal(pieces.map(p => p.text).join(''), text); assert.equal(pieces[1].start, 8000);
});
