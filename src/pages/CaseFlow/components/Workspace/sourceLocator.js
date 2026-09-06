// Only authoritative segment IDs establish a location. A quote alone is not an anchor.
export function locateEvidence(segments, evidence) {
  const segment = segments.find(s => String(s.id) === String(evidence?.segment_id));
  if (!segment) return { status: 'missing' };
  const content = segment.content || '';
  const quote = evidence.quote || '';
  const start = content.indexOf(quote);
  if (quote && start >= 0 && content.indexOf(quote, start + 1) < 0) {
    return { status: 'exact', segment, start, end: start + quote.length };
  }
  return { status: 'segment', segment };
}
