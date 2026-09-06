import { test } from 'node:test';
import assert from 'node:assert/strict';
import { locateEvidence } from './sourceLocator.js';
const segments = [{ id: 7, content: '社区建立协商平台，居民参与。' }];
test('locates a unique quote within the authoritative segment', () => {
  const result = locateEvidence(segments, { segment_id: '7', quote: '协商平台' });
  assert.equal(result.status, 'exact');
  assert.equal(result.segment.content.slice(result.start, result.end), '协商平台');
});
test('does not substitute matching text from an unrelated segment', () => {
  assert.equal(locateEvidence(segments, { segment_id: 8, quote: '协商平台' }).status, 'missing');
});
test('missing and repeated quotes produce paragraph precision only', () => {
  assert.equal(locateEvidence(segments, { segment_id: 7, quote: '不存在' }).status, 'segment');
  assert.equal(locateEvidence([{ id: 7, content: '平台与平台' }], { segment_id: 7, quote: '平台' }).status, 'segment');
  assert.equal(locateEvidence(segments, { segment_id: 7 }).status, 'segment');
});
