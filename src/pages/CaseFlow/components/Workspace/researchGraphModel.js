export function collectUnits(draft, extractions, legacy) {
  const units = (draft?.paragraphs || []).flatMap(p => (p.units || []).map(u => ({ ...u, paragraphIds: [p.id], citations: u.citations?.length ? u.citations : p.citations })));
  if (units.length) return units;
  if (draft) return (extractions || []).filter(e => e.draftId === draft.id).flatMap(e => e.items.filter(i => i.kind === 'relation' && i.status !== 'rejected' && i.sourceName && i.targetName).map(i => ({ ...i, subject: i.sourceName, predicate: i.relationType || i.type, object: i.targetName, citations: draft.paragraphs.filter(p => i.paragraphIds.includes(p.id)).flatMap(p => p.citations) })));
  const entities = legacy?.entities || [];
  return (legacy?.relations || []).map(r => ({ id: `legacy-${r.id}`, subject: r.source_name || entities.find(e => String(e.id) === String(r.source_entity_id || r.sourceId))?.name || String(r.sourceId || ''), predicate: r.relation_type || r.relationType, object: r.target_name || entities.find(e => String(e.id) === String(r.target_entity_id || r.targetId))?.name || String(r.targetId || ''), paragraphIds: [], citations: [], status: r.status }));
}
