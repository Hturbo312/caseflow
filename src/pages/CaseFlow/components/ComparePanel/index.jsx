import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { FileText, X, MapPin, Calendar, ShieldAlert, Loader2 } from 'lucide-react';
import { useCaseStore, useSchemaStore } from '../../../../store';
import { compareApi, evidenceApi } from '../../../../services/api';
import { useI18n } from '../../../../i18n';
import './ComparePanel.css';

/**
 * ComparePanel - 跨案例对比面板
 * 行 = 当前 Schema 的实体类型维度，列 = 选中的案例
 * 单元格 = 该维度知识摘要（实体 chips + 证据覆盖），点击实体查看证据链（引文 + 原文出处）
 */
const ComparePanel = () => {
  const { t } = useI18n();
  const cases = useCaseStore((s) => s.cases);
  const { currentSchemaId, schemas } = useSchemaStore();
  const [selectedIds, setSelectedIds] = useState([]);
  const [matrixData, setMatrixData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [drawer, setDrawer] = useState(null); // { entity, loading, items }

  // 当前 Schema 下的可比案例（排除孤儿案例）
  const comparableCases = useMemo(() => {
    if (!currentSchemaId) return [];
    return cases.filter((c) => {
      if (c.schemaId == null) return false;
      return String(c.schemaId) === String(currentSchemaId);
    });
  }, [cases, currentSchemaId]);

  const schemaName = useMemo(() => {
    const schema = schemas.find((s) => String(s.id) === String(currentSchemaId));
    return schema?.name || '-';
  }, [schemas, currentSchemaId]);

  const toggleCase = useCallback((id) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }, []);

  useEffect(() => {
    if (selectedIds.length < 2 || !currentSchemaId) {
      setMatrixData(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    compareApi.matrix(currentSchemaId, selectedIds)
      .then((data) => { if (!cancelled) setMatrixData(data); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [selectedIds, currentSchemaId]);

  const openEvidence = useCallback(async (entity) => {
    setDrawer({ entity, loading: true, items: null });
    try {
      const data = await evidenceApi.getByEntity(entity.id);
      setDrawer({ entity, loading: false, items: data.evidence || [] });
    } catch (e) {
      setDrawer({ entity, loading: false, items: [], error: e.message });
    }
  }, []);

  const cellCoverage = (cell) => {
    if (cell.count === 0) return null;
    return `${cell.evidence_count}/${cell.count}`;
  };

  return (
    <div className="compare-panel">
      <div className="compare-header">
        <h2 className="compare-title">{t('compare.title')}</h2>
        <span className="compare-schema-badge">{schemaName}</span>
        <p className="compare-hint">{t('compare.selectHint')}</p>
      </div>

      {/* 案例选择 chips */}
      <div className="compare-case-picker">
        {comparableCases.length === 0 && (
          <span className="compare-empty-hint">{t('compare.empty')}</span>
        )}
        {comparableCases.map((c) => (
          <button
            key={c.id}
            className={`compare-case-chip ${selectedIds.includes(c.id) ? 'selected' : ''}`}
            onClick={() => toggleCase(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* 矩阵 */}
      {selectedIds.length < 2 ? (
        <div className="compare-placeholder">{t('compare.minHint')}</div>
      ) : loading ? (
        <div className="compare-placeholder"><Loader2 className="spin" size={18} /> {t('compare.loading')}</div>
      ) : error ? (
        <div className="compare-placeholder compare-error">{error}</div>
      ) : matrixData ? (
        <div className="compare-matrix-wrap">
          <table className="compare-matrix">
            <thead>
              <tr>
                <th className="compare-dim-col" />
                {matrixData.cases.map((c) => (
                  <th key={c.id} className="compare-case-col">
                    <div className="compare-case-name">{c.name}</div>
                    <div className="compare-case-meta">
                      {c.entity_count} 实体 · {c.relation_count} 关系
                      {c.location && <div><MapPin size={10} style={{ display: 'inline' }} /> {c.location}</div>}
                      {c.year && <div><Calendar size={10} style={{ display: 'inline' }} /> {c.year}</div>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixData.matrix.map((row) => (
                <tr key={row.type_id}>
                  <td className="compare-dim-col">
                    <span className="compare-dim-dot" style={{ backgroundColor: row.color || '#6366f1' }} />
                    {row.type_name}
                  </td>
                  {row.cells.map((cell) => (
                    <td key={`${row.type_id}:${cell.case_id}`} className="compare-cell">
                      {cell.count === 0 ? (
                        <span className="compare-cell-empty">{t('compare.emptyCell')}</span>
                      ) : (
                        <>
                          <div className="compare-cell-entities">
                            {cell.entities.map((e) => (
                              <button
                                key={e.id}
                                className="compare-entity-chip"
                                style={{ borderColor: e.color || '#6366f1' }}
                                onClick={() => openEvidence(e)}
                                title={t('compare.evidence')}
                              >
                                {e.name}
                              </button>
                            ))}
                            {cell.count > cell.entities.length && (
                              <span className="compare-entity-more">+{cell.count - cell.entities.length}</span>
                            )}
                          </div>
                          <div className="compare-cell-coverage">
                            {t('compare.coverage')} {cellCoverage(cell)}
                          </div>
                        </>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* 证据抽屉 */}
      {drawer && (
        <div className="compare-drawer-mask" onClick={() => setDrawer(null)}>
          <div className="compare-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="compare-drawer-header">
              <span className="compare-drawer-dot" style={{ backgroundColor: drawer.entity.color || '#6366f1' }} />
              <span className="compare-drawer-name">{drawer.entity.name}</span>
              <button className="compare-drawer-close" onClick={() => setDrawer(null)}><X size={16} /></button>
            </div>
            {drawer.loading ? (
              <div className="compare-drawer-body"><Loader2 className="spin" size={16} /> {t('compare.loading')}</div>
            ) : !drawer.items || drawer.items.length === 0 ? (
              <div className="compare-drawer-body">
                <ShieldAlert size={14} /> {t('compare.noEvidence')}
              </div>
            ) : (
              <div className="compare-drawer-body">
                {drawer.items.map((ev) => (
                  <div key={ev.id} className="compare-evidence-item">
                    <div className="compare-evidence-quote">
                      <FileText size={12} />
                      <p>“{ev.quote}”</p>
                    </div>
                    <div className="compare-evidence-meta">
                      {t('compare.source')}：
                      {ev.document_title || t('compare.noSegment')}
                      {ev.document_title && ` · ${ev.source_type === 'legacy' ? '原始材料' : ev.source_type}`}
                      {ev.page != null && ` · 第${ev.page}页`}
                      {ev.segment_content && (
                        <div className="compare-evidence-segment">{ev.segment_content}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparePanel;
